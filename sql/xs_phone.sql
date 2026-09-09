-- XS-Phone schema
-- The resource also creates all of this automatically on first start
-- (server/db.lua), so importing this file manually is optional — it exists
-- for server owners who prefer to manage schema themselves.

CREATE TABLE IF NOT EXISTS `phone_phones` (
    `citizenid`      VARCHAR(50)  NOT NULL,
    `number`         VARCHAR(15)  NOT NULL,
    `pin`            VARCHAR(10)  DEFAULT NULL,
    `settings`       LONGTEXT     DEFAULT NULL,
    `installed_apps` LONGTEXT     DEFAULT NULL,
    `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`citizenid`),
    UNIQUE KEY `number` (`number`)
);

CREATE TABLE IF NOT EXISTS `phone_contacts` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `owner_number` VARCHAR(15)  NOT NULL,
    `saved_number` VARCHAR(15)  NOT NULL,
    `name`         VARCHAR(50)  NOT NULL,
    `avatar_url`   VARCHAR(255) DEFAULT NULL,
    `favorite`     TINYINT(1)   NOT NULL DEFAULT 0,
    `blocked`      TINYINT(1)   NOT NULL DEFAULT 0,
    `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `owner_saved` (`owner_number`, `saved_number`),
    KEY `owner` (`owner_number`)
);

CREATE TABLE IF NOT EXISTS `phone_threads` (
    `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `is_group`   TINYINT(1)   NOT NULL DEFAULT 0,
    `name`       VARCHAR(50)  DEFAULT NULL,
    `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `phone_thread_members` (
    `thread_id` INT UNSIGNED NOT NULL,
    `number`    VARCHAR(15)  NOT NULL,
    `muted`     TINYINT(1)   NOT NULL DEFAULT 0,
    `last_read` INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`thread_id`, `number`),
    KEY `member` (`number`)
);

CREATE TABLE IF NOT EXISTS `phone_messages` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `thread_id`     INT UNSIGNED NOT NULL,
    `sender_number` VARCHAR(15)  NOT NULL,
    `body`          TEXT         NOT NULL,
    `media_url`     VARCHAR(255) DEFAULT NULL,
    `location`      VARCHAR(100) DEFAULT NULL,
    `sent_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `thread` (`thread_id`, `id`)
);

CREATE TABLE IF NOT EXISTS `phone_calls` (
    `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `caller`     VARCHAR(15)  NOT NULL,
    `callee`     VARCHAR(15)  NOT NULL,
    `anonymous`  TINYINT(1)   NOT NULL DEFAULT 0,
    `state`      VARCHAR(12)  NOT NULL,
    `duration`   INT UNSIGNED NOT NULL DEFAULT 0,
    `started_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `caller` (`caller`, `id`),
    KEY `callee` (`callee`, `id`)
);

CREATE TABLE IF NOT EXISTS `phone_photos` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `owner_number` VARCHAR(15)  NOT NULL,
    `url`          VARCHAR(255) NOT NULL,
    `taken_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `owner` (`owner_number`, `id`)
);

CREATE TABLE IF NOT EXISTS `phone_transactions` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `from_number` VARCHAR(15)  NOT NULL,
    `to_number`   VARCHAR(15)  NOT NULL,
    `amount`      INT UNSIGNED NOT NULL,
    `note`        VARCHAR(80)  DEFAULT NULL,
    `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `from` (`from_number`, `id`),
    KEY `to` (`to_number`, `id`)
);

CREATE TABLE IF NOT EXISTS `phone_notes` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `owner_number` VARCHAR(15)  NOT NULL,
    `title`        VARCHAR(60)  NOT NULL,
    `body`         TEXT         NOT NULL,
    `updated_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `owner` (`owner_number`, `id`)
);

CREATE TABLE IF NOT EXISTS `phone_alarms` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `owner_number` VARCHAR(15)  NOT NULL,
    `time`         CHAR(5)      NOT NULL,
    `label`        VARCHAR(40)  DEFAULT NULL,
    `enabled`      TINYINT(1)   NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    KEY `owner` (`owner_number`)
);

CREATE TABLE IF NOT EXISTS `phone_social_profiles` (
    `number`     VARCHAR(15)  NOT NULL,
    `handle`     VARCHAR(20)  NOT NULL,
    `display`    VARCHAR(30)  NOT NULL,
    `bio`        VARCHAR(160) DEFAULT NULL,
    `avatar_url` VARCHAR(255) DEFAULT NULL,
    `banner_url` VARCHAR(255) DEFAULT NULL,
    `password`   VARCHAR(64)  DEFAULT NULL,
    `verified`   TINYINT(1)   NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`number`),
    UNIQUE KEY `handle` (`handle`)
);

CREATE TABLE IF NOT EXISTS `phone_social_posts` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `author_number` VARCHAR(15)  NOT NULL,
    `body`          VARCHAR(500) NOT NULL,
    `image_url`     VARCHAR(255) DEFAULT NULL,
    `reply_to`      INT UNSIGNED DEFAULT NULL,
    `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `author` (`author_number`, `id`),
    KEY `replies` (`reply_to`, `id`)
);

CREATE TABLE IF NOT EXISTS `phone_social_likes` (
    `post_id` INT UNSIGNED NOT NULL,
    `number`  VARCHAR(15)  NOT NULL,
    PRIMARY KEY (`post_id`, `number`)
);

CREATE TABLE IF NOT EXISTS `phone_social_follows` (
    `follower` VARCHAR(15) NOT NULL,
    `followed` VARCHAR(15) NOT NULL,
    PRIMARY KEY (`follower`, `followed`)
);

CREATE TABLE IF NOT EXISTS `phone_mail` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `owner_number` VARCHAR(15)  NOT NULL,
    `from_display` VARCHAR(30)  NOT NULL,
    `from_number`  VARCHAR(15)  DEFAULT NULL,
    `subject`      VARCHAR(80)  NOT NULL,
    `body`         TEXT         NOT NULL,
    `image_url`    VARCHAR(255) DEFAULT NULL,
    `is_read`      TINYINT(1)   NOT NULL DEFAULT 0,
    `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `owner` (`owner_number`, `id`)
);

CREATE TABLE IF NOT EXISTS `phone_market` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `seller_number` VARCHAR(15)  NOT NULL,
    `title`         VARCHAR(60)  NOT NULL,
    `body`          VARCHAR(500) NOT NULL,
    `price`         INT UNSIGNED NOT NULL DEFAULT 0,
    `image_url`     VARCHAR(255) DEFAULT NULL,
    `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `seller` (`seller_number`)
);

CREATE TABLE IF NOT EXISTS `phone_darkchat_rooms` (
    `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code`       CHAR(6)      NOT NULL,
    `name`       VARCHAR(30)  NOT NULL,
    `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `code` (`code`)
);

CREATE TABLE IF NOT EXISTS `phone_darkchat_members` (
    `room_id` INT UNSIGNED NOT NULL,
    `number`  VARCHAR(15)  NOT NULL,
    `handle`  VARCHAR(20)  NOT NULL,
    PRIMARY KEY (`room_id`, `number`),
    KEY `member` (`number`)
);

CREATE TABLE IF NOT EXISTS `phone_darkchat_messages` (
    `id`      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `room_id` INT UNSIGNED NOT NULL,
    `handle`  VARCHAR(20)  NOT NULL,
    `body`    VARCHAR(500) NOT NULL,
    `sent_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `room` (`room_id`, `id`)
);

CREATE TABLE IF NOT EXISTS `phone_prism_posts` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `author_number` VARCHAR(15)  NOT NULL,
    `image_url`     VARCHAR(255) NOT NULL,
    `caption`       VARCHAR(200) DEFAULT NULL,
    `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `author` (`author_number`, `id`)
);

CREATE TABLE IF NOT EXISTS `phone_prism_likes` (
    `post_id` INT UNSIGNED NOT NULL,
    `number`  VARCHAR(15)  NOT NULL,
    PRIMARY KEY (`post_id`, `number`)
);

CREATE TABLE IF NOT EXISTS `phone_prism_comments` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `post_id`       INT UNSIGNED NOT NULL,
    `author_number` VARCHAR(15)  NOT NULL,
    `body`          VARCHAR(300) NOT NULL,
    `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `post` (`post_id`, `id`)
);

CREATE TABLE IF NOT EXISTS `phone_match_profiles` (
    `number`     VARCHAR(15)  NOT NULL,
    `username`   VARCHAR(20)  DEFAULT NULL,
    `password`   VARCHAR(64)  DEFAULT NULL,
    `name`       VARCHAR(30)  NOT NULL,
    `age`        TINYINT UNSIGNED NOT NULL,
    `bio`        VARCHAR(200) DEFAULT NULL,
    `photos`     LONGTEXT     NOT NULL,
    `active`     TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`number`),
    UNIQUE KEY `username` (`username`)
);

CREATE TABLE IF NOT EXISTS `phone_match_swipes` (
    `swiper` VARCHAR(15) NOT NULL,
    `target` VARCHAR(15) NOT NULL,
    `liked`  TINYINT(1)  NOT NULL,
    PRIMARY KEY (`swiper`, `target`)
);

CREATE TABLE IF NOT EXISTS `phone_match_matches` (
    `a`          VARCHAR(15) NOT NULL,
    `b`          VARCHAR(15) NOT NULL,
    `created_at` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`a`, `b`),
    KEY `b` (`b`)
);

CREATE TABLE IF NOT EXISTS `phone_music` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `owner_number` VARCHAR(15)  NOT NULL,
    `title`        VARCHAR(60)  NOT NULL,
    `url`          VARCHAR(255) NOT NULL,
    `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `owner` (`owner_number`, `id`)
);

CREATE TABLE IF NOT EXISTS  (
        VARCHAR(60) NOT NULL,
       VARCHAR(64) NOT NULL,
         VARCHAR(15) DEFAULT NULL,
     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (),
    KEY  ()
);

CREATE TABLE IF NOT EXISTS  (
                INT UNSIGNED NOT NULL AUTO_INCREMENT,
     VARCHAR(60)  NOT NULL,
            VARCHAR(6)   NOT NULL DEFAULT 'inbox',
      VARCHAR(60)  NOT NULL,
        VARCHAR(60)  NOT NULL,
           VARCHAR(80)  NOT NULL,
              TEXT         NOT NULL,
         VARCHAR(255) DEFAULT NULL,
           TINYINT(1)   NOT NULL DEFAULT 0,
        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (),
    KEY  (, , )
);

CREATE TABLE IF NOT EXISTS `phone_mail_accounts` (
    `address`    VARCHAR(60) NOT NULL,
    `password`   VARCHAR(64) NOT NULL,
    `number`     VARCHAR(15) DEFAULT NULL,
    `created_at` TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`address`),
    KEY `number` (`number`)
);

CREATE TABLE IF NOT EXISTS `phone_emails` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `owner_address` VARCHAR(60)  NOT NULL,
    `folder`        VARCHAR(6)   NOT NULL DEFAULT 'inbox',
    `from_address`  VARCHAR(60)  NOT NULL,
    `to_address`    VARCHAR(60)  NOT NULL,
    `subject`       VARCHAR(80)  NOT NULL,
    `body`          TEXT         NOT NULL,
    `image_url`     VARCHAR(255) DEFAULT NULL,
    `is_read`       TINYINT(1)   NOT NULL DEFAULT 0,
    `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `owner` (`owner_address`, `folder`, `id`)
);
