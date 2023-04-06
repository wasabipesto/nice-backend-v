DROP TABLE IF EXISTS History;
CREATE TABLE IF NOT EXISTS History (
    id SERIAL PRIMARY KEY,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    username TEXT NOT NULL,
    searched_detailed NUMERIC NOT NULL DEFAULT 0,
    searched_niceonly NUMERIC NOT NULL DEFAULT 0
);