const knex = require("knex")({
  client: "pg",
  connection: process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: "localhost",
        user: "postgres",
        password: process.env.DB_PASSWORD || "",
        database: "country_catalog",
        port: 5432
      }
});

module.exports = knex;