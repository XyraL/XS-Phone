Billing = {}

local invoiceCols = nil

local function cfg()
    return Config.Phone.Bills or {}
end

local function tableExists(name)
    return MySQL.scalar.await(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1',
        { name }) ~= nil
end

function Billing.Init()
    if cfg().enabled == false or cfg().invoiceTable == false then return end
    if not tableExists('phone_invoices') then
        MySQL.query.await([[
            CREATE TABLE IF NOT EXISTS `phone_invoices` (
                `id`              INT(10)      NOT NULL AUTO_INCREMENT,
                `citizenid`       VARCHAR(50)  DEFAULT NULL,
                `amount`          INT(11)      NOT NULL DEFAULT 0,
                `society`         TINYTEXT     DEFAULT NULL,
                `sender`          VARCHAR(50)  DEFAULT NULL,
                `sendercitizenid` VARCHAR(50)  DEFAULT NULL,
                `candecline`      INT(1)       NOT NULL DEFAULT 1,
                `reason`          VARCHAR(256) DEFAULT NULL,
                PRIMARY KEY (`id`),
                KEY `citizenid` (`citizenid`)
            )
        ]])
    end
    invoiceCols = {}
    for _, row in ipairs(MySQL.query.await('SHOW COLUMNS FROM `phone_invoices`') or {}) do
        invoiceCols[row.Field] = true
    end
end

function Billing.Sources()
    local list = {}
    if cfg().enabled == false then return list end
    if invoiceCols then list[#list + 1] = 'invoices' end
    if GetResourceState('okokBilling') == 'started' then list[#list + 1] = 'okok' end
    if GetResourceState('peleg-billing') == 'started' then list[#list + 1] = 'peleg' end
    return list
end

function Billing.JobLabel(name)
    if not name or name == '' then return 'Unknown' end
    local label = Framework.JobLabel and Framework.JobLabel(name)
    if label then return label end
    for _, biz in ipairs(Config.Phone.Businesses or {}) do
        if biz.job == name then return biz.label end
    end
    return (tostring(name):gsub('^%l', string.upper))
end

local function isFine(society)
    for _, job in ipairs(cfg().fineJobs or {}) do
        if job == society then return true end
    end
    return false
end

local function okokTable()
    return cfg().okokTable or 'okokbilling'
end

function Billing.List(cid)
    local out = {}
    for _, source in ipairs(Billing.Sources()) do
        if source == 'invoices' then
            local rows = MySQL.query.await('SELECT * FROM phone_invoices WHERE citizenid = ? ORDER BY id DESC LIMIT 50', { cid }) or {}
            for _, r in ipairs(rows) do
                local declinable = r.candecline == nil and cfg().allowDecline ~= false or DbBool(r.candecline)
                out[#out + 1] = {
                    key = 'invoices:' .. r.id, source = 'invoices', id = r.id,
                    amount = math.floor(tonumber(r.amount) or 0),
                    payee = Billing.JobLabel(r.society), from = r.sender, label = r.reason,
                    fine = isFine(r.society), canDecline = declinable and cfg().allowDecline ~= false,
                }
            end
        elseif source == 'okok' then
            local ok, rows = pcall(MySQL.query.await,
                ('SELECT * FROM `%s` WHERE receiver_identifier = ? AND status = ? ORDER BY id DESC LIMIT 50'):format(okokTable()),
                { cid, 'unpaid' })
            for _, r in ipairs(ok and rows or {}) do
                out[#out + 1] = {
                    key = 'okok:' .. r.id, source = 'okok', id = r.id,
                    amount = math.floor(tonumber(r.invoice_value) or 0),
                    payee = r.society_name or Billing.JobLabel(r.society), from = r.author_name,
                    label = r.item or r.notes, fine = isFine(r.society), canDecline = false,
                }
            end
        elseif source == 'peleg' then
            local ok, rows = pcall(MySQL.query.await,
                'SELECT * FROM billing_bills WHERE cid = ? AND status = ? ORDER BY id DESC LIMIT 50', { cid, 'unpaid' })
            for _, r in ipairs(ok and rows or {}) do
                out[#out + 1] = {
                    key = 'peleg:' .. r.id, source = 'peleg', id = r.id,
                    amount = math.floor(tonumber(r.amount) or 0),
                    payee = Billing.JobLabel(r.job), from = r.issuer_name, label = r.description,
                    fine = isFine(r.job), canDecline = false, at = r.created_at,
                }
            end
        end
    end
    return out
end

local function account()
    return cfg().account or 'bank'
end

local function payInvoice(src, cid, id)
    local row = MySQL.single.await('SELECT * FROM phone_invoices WHERE id = ? AND citizenid = ?', { id, cid })
    if not row then return false, 'gone' end
    local amount = math.floor(tonumber(row.amount) or 0)
    if Framework.GetMoney(src, account()) < amount then return false, 'insufficient' end
    if amount > 0 and not Framework.RemoveMoney(src, account(), amount, 'paid-invoice') then
        return false, 'insufficient'
    end
    local removed = MySQL.update.await('DELETE FROM phone_invoices WHERE id = ? AND citizenid = ?', { id, cid })
    if removed ~= 1 then
        if amount > 0 then Framework.AddMoney(src, account(), amount, 'invoice refund') end
        return false, 'gone'
    end
    if amount > 0 then Banking.Deposit(row.society, amount, 'Phone invoice') end
    TriggerEvent('qb-phone:server:paidInvoice', src, id)
    return true, { amount = amount, payee = Billing.JobLabel(row.society), label = row.reason }
end

local function payOkok(src, cid, id)
    local row = MySQL.single.await(
        ('SELECT * FROM `%s` WHERE id = ? AND receiver_identifier = ? AND status = ?'):format(okokTable()),
        { id, cid, 'unpaid' })
    if not row then return false, 'gone' end
    local amount = math.floor(tonumber(row.invoice_value) or 0)
    if Framework.GetMoney(src, account()) < amount then return false, 'insufficient' end
    local ok, result = pcall(function() return exports.okokBilling:payInvoice(row) end)
    if not ok then return false, 'pay_elsewhere' end
    if not result then return false, 'failed' end
    return true, { amount = amount, payee = row.society_name or Billing.JobLabel(row.society), label = row.item or row.notes }
end

local function payPeleg(src, cid, id)
    local row = MySQL.single.await('SELECT * FROM billing_bills WHERE id = ? AND cid = ? AND status = ?', { id, cid, 'unpaid' })
    if not row then return false, 'gone' end
    local amount = math.floor(tonumber(row.amount) or 0)
    local ok, result = pcall(function() return exports['peleg-billing']:PayBill(id, src) end)
    if not ok then return false, 'pay_elsewhere' end
    local status = MySQL.scalar.await('SELECT status FROM billing_bills WHERE id = ?', { id })
    if status ~= 'paid' and not result then return false, 'insufficient' end
    return true, { amount = amount, payee = Billing.JobLabel(row.job), label = row.description }
end

function Billing.Pay(src, cid, source, id)
    if source == 'invoices' and invoiceCols then return payInvoice(src, cid, id) end
    if source == 'okok' and GetResourceState('okokBilling') == 'started' then return payOkok(src, cid, id) end
    if source == 'peleg' and GetResourceState('peleg-billing') == 'started' then return payPeleg(src, cid, id) end
    return false, 'gone'
end

function Billing.Decline(src, cid, source, id)
    if source ~= 'invoices' or not invoiceCols or cfg().allowDecline == false then return false, 'cannot_decline' end
    local row = MySQL.single.await('SELECT * FROM phone_invoices WHERE id = ? AND citizenid = ?', { id, cid })
    if not row then return false, 'gone' end
    if row.candecline ~= nil and not DbBool(row.candecline) then return false, 'cannot_decline' end
    MySQL.update.await('DELETE FROM phone_invoices WHERE id = ? AND citizenid = ?', { id, cid })
    TriggerEvent('qb-phone:server:declinedInvoice', src, id)
    return true, { amount = math.floor(tonumber(row.amount) or 0), payee = Billing.JobLabel(row.society), label = row.reason }
end

function Billing.Create(targetCid, amount, society, reason, senderName, senderCid, canDecline)
    if not invoiceCols then return nil end
    local cols, vals = { 'citizenid', 'amount', 'society', 'sender', 'sendercitizenid' },
        { targetCid, amount, society, senderName, senderCid }
    if invoiceCols.candecline then
        cols[#cols + 1] = 'candecline'
        vals[#vals + 1] = canDecline == false and 0 or 1
    end
    if invoiceCols.reason then
        cols[#cols + 1] = 'reason'
        vals[#vals + 1] = reason
    end
    local marks = {}
    for i = 1, #cols do marks[i] = '?' end
    return MySQL.insert.await(('INSERT INTO phone_invoices (%s) VALUES (%s)'):format(
        table.concat(cols, ', '), table.concat(marks, ', ')), vals)
end
