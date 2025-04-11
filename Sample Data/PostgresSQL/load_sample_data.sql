CREATE TABLE sample_users (
    name TEXT,
    age INT,
    created_at TIMESTAMP,
    profile JSON,
    tags JSON
);



COPY sample_users(name, age, created_at, profile, tags)
FROM 'sample_users_1000.csv' -- modify path as required
DELIMITER ','
CSV HEADER;

select *
from sample_users