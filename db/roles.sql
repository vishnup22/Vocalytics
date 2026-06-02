CREATE ROLE vocallytics_ro LOGIN PASSWORD 'change_me_strong_password';

GRANT CONNECT ON DATABASE vocallytics TO vocallytics_ro;
GRANT USAGE ON SCHEMA public TO vocallytics_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO vocallytics_ro;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO vocallytics_ro;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM vocallytics_ro;
