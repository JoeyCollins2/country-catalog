const express = require("express")
const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

const session = require("express-session");
app.use(session({
  secret: "country-secret",
  resave: false,
  saveUninitialized: false
}));
app.use(express.static("public"));

function requireLogin(req, res, next){
    if (req.session.isLoggedIn){
        next();
    } else {
        res.redirect("/")
    }
}

function validateCountry(body) {
  const errors = [];

  const name = (body.country_name || "").trim();
  const site = (body.popular_site || "").trim();
  const capital = (body.capital || "").trim();
  const population = Number(body.population);
  const visited = body.visited || null;

  if (name === "" || name.length > 30) {
    errors.push("Country name is required (max 30 characters).");
  }
  if (site === "" || site.length > 50) {
    errors.push("Popular site is required (max 50 characters).");
  }
  if (capital === "" || capital.length > 30) {
    errors.push("Capital is required (max 30 characters).");
  }
  if (body.population === "" || !Number.isInteger(population) || population < 0) {
    errors.push("Population must be a whole number 0 or greater.");
  }
  if (visited !== null && visited !== "Y" && visited !== "N") {
    errors.push("Visited must be Y or N.");
  }

  return errors;
}

const knex = require("./db");
app.get("/", (req, res) => {
    res.render("index", {isLoggedIn: req.session.isLoggedIn, error: null });
});
app.post("/login", (req, res) => {
  knex("users")
    .where({ username: req.body.username, password: req.body.password })
    .first()
    .then(user => {
      if (user) {
        req.session.isLoggedIn = true;
        res.redirect("/");
      } else {
        res.render("index", { isLoggedIn: false, error: "Invalid login" });
      }
    })
    .catch(err => {
      console.log(err);
      res.status(500).send("Database error");
    });
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});
app.get("/countries", requireLogin, (req, res) => {
    knex("country")
    .select("*")
    .then(countries => {
        res.render("countries", { countries: countries });
    })
    .catch(err => {
        console.log(err);
        res.status(500).send("Database error")
    })
})

app.get("/addCountry", requireLogin, (req, res) => {
  res.render("addCountry", { errors: [], country: {} });
});
app.get("/editCountry/:country_id", requireLogin, (req, res) => {
  knex("country")
    .select("*")
    .where("country_id", req.params.country_id)
    .then(countries => {
      if (countries.length === 0) {
        res.status(404).send("Country not found");
      } else {
        res.render("editCountry", { errors: [], country: countries[0] });
      }
    })
    .catch(err => {
      console.log(err);
      res.status(500).send("Database error");
    });
});

app.post("/editCountry/:country_id", requireLogin, (req, res) => {
  const errors = validateCountry(req.body);
  if (errors.length > 0) {
    return res.render("editCountry", {
      errors: errors,
      country: { ...req.body, country_id: req.params.country_id }
    });
  }

  knex("country")
    .where("country_id", req.params.country_id)
    .update({
      country_name: req.body.country_name.trim(),
      popular_site: req.body.popular_site.trim(),
      capital: req.body.capital.trim(),
      population: Number(req.body.population),
      visited: req.body.visited || null
    })
    .then(() => {
      res.redirect("/countries");
    })
    .catch(err => {
      console.log(err);
      res.status(500).send("Error updating country");
    });
});
app.post("/addCountry", requireLogin, (req, res) => {
  const errors = validateCountry(req.body);
  if (errors.length > 0) {
    return res.render("addCountry", { errors: errors, country: req.body });
  }

  knex("country")
    .insert({
      country_name: req.body.country_name.trim(),
      popular_site: req.body.popular_site.trim(),
      capital: req.body.capital.trim(),
      population: Number(req.body.population),
      visited: req.body.visited || null
    })
    .then(() => {
      res.redirect("/countries");
    })
    .catch(err => {
      console.log(err);
      res.status(500).send("Error adding country");
    });
});

app.post("/deleteCountry/:country_id", requireLogin, (req, res) => {
  knex("country")
    .where("country_id", req.params.country_id)
    .del()
    .then(() => {
      res.redirect("/countries");
    })
    .catch(err => {
      console.log(err);
      res.status(500).send("Error deleting country");
    });
});
app.post("/editCountry/:country_id", requireLogin, (req, res) => {
  knex("country")
    .where("country_id", req.params.country_id)
    .update({
      country_name: req.body.country_name,
      popular_site: req.body.popular_site,
      capital: req.body.capital,
      population: req.body.population,
      visited: req.body.visited || null
    })
    .then(() => {
      res.redirect("/countries");
    })
    .catch(err => {
      console.log(err);
      res.status(500).send("Error updating country");
    });
});

app.get("/api/country/:country_id", requireLogin, (req, res) => {
  knex("country")
    .where("country_id", req.params.country_id)
    .first()
    .then(country => {
      if (!country) {
        return res.status(404).json({ error: "Country not found" });
      }

      const url = "https://nominatim.openstreetmap.org/search?country=" +
        encodeURIComponent(country.country_name) + "&format=jsonv2&limit=1";

      return fetch(url, {
        headers: {
          "User-Agent": "country-catalog-class-project",
          "Accept-Language": "en"
        }
      })
        .then(response => response.json())
        .then(places => {
          if (places.length === 0) {
            return res.status(404).json({ error: "Location not found" });
          }
          const place = places[0];
          res.json({
            name: country.country_name,
            lat: Number(place.lat),
            lon: Number(place.lon),
            bounds: place.boundingbox.map(Number)
          });
        });
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({ error: "Error retrieving map" });
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("listening on " + port));