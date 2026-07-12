-- Concurrency-safe asset tag generation: AF-0001, AF-0002, ...
-- nextval() is atomic across concurrent transactions, so two simultaneous
-- registrations can never receive the same tag (unlike a MAX()+1 approach).
CREATE SEQUENCE IF NOT EXISTS asset_tag_seq START 1;
