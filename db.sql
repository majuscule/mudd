SET storage_engine=INNODB;
SET character_set_database=utf8;

CREATE TABLE rooms (
    `id` int not null auto_increment,
    `x` int not null,
    `y` int not null,
    `state` boolean not null,
    `description` text,
    PRIMARY KEY (`id`),
    INDEX `coordinates` (`x`,`y`)
);

CREATE TABLE `players` (
    `id` int not null auto_increment,
    `name` varchar(32) not null,
    `room` int not null,
    `last_active` timestamp default current_timestamp,
    PRIMARY KEY (`id`),
    CONSTRAINT `location` FOREIGN KEY (`room`) REFERENCES `rooms` (`id`)
);

CREATE TABLE `messages` (
    `id` int not null auto_increment,
    `message` text not null,
    `room` int not null,
    `type` ENUM('say', 'tell', 'yell') not null,
    `destination` int,
    `source` int,
    `sent` timestamp default current_timestamp,
    PRIMARY KEY (`id`),
    CONSTRAINT `origin` FOREIGN KEY (`source`) REFERENCES `players` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `addressable` FOREIGN KEY (`destination`) REFERENCES `players` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `place` FOREIGN KEY (`room`) REFERENCES `rooms` (`id`)
);

CREATE EVENT `purge_inactive_players`
    ON SCHEDULE EVERY 1 MINUTE STARTS now()
    DO DELETE FROM `players` WHERE `last_active` < now() - interval 5 minute;

CREATE EVENT `purge_old_messages`
    ON SCHEDULE EVERY 1 MINUTE STARTS now()
    DO DELETE FROM `messages` WHERE `sent` < now() - interval 5 minute;
