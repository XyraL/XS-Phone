function NormalizeNumber(input)
    if type(input) ~= 'string' then return nil end
    local digits = input:gsub('%D', '')
    local fmt = Config.Phone.Numbers.format
    local needed = select(2, fmt:gsub('#', ''))
    if #digits ~= needed then return nil end
    local i = 0
    return (fmt:gsub('#', function()
        i = i + 1
        return digits:sub(i, i)
    end))
end

function DbBool(v)
    return v == true or v == 1 or v == '1'
end
