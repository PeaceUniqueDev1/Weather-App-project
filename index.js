const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const searchButton = document.getElementById("search-button");
const locationButton = document.getElementById("location-button");
const unitButton = document.getElementById("unit-button");
const message = document.getElementById("message");
const weatherSection = document.getElementById("weather");

let temperatureUnit = "celsius";
let currentPlace = null;
let requestNumber = 0;

const weatherDescriptions = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Foggy", "🌫️"],
  48: ["Foggy with frost", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Heavy freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Heavy freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"],
  80: ["Light rain showers", "🌦️"],
  81: ["Rain showers", "🌧️"],
  82: ["Heavy rain showers", "⛈️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Severe thunderstorm with hail", "⛈️"]
};

function getWeatherDescription(code) {
  return weatherDescriptions[code] || ["Weather conditions unavailable", "🌍"];
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.className = isError ? "message error" : "message";
}

function getTemperatureSymbol() {
  return temperatureUnit === "celsius" ? "°C" : "°F";
}

function formatTemperature(value) {
  return Math.round(value) + getTemperatureSymbol();
}

function formatDay(dateString) {
  const date = new Date(dateString + "T12:00:00");

  return date.toLocaleDateString("en", {
    weekday: "short",
    day: "numeric"
  });
}

function getAdvice(code, rainChance, temperature) {
  if ([95, 96, 99].includes(code)) {
    return "⛈️ A thunderstorm is possible. Stay in a safe place and avoid exposed areas.";
  }

  if ([65, 67, 82].includes(code) || rainChance >= 70) {
    return "☔ Rain is likely. Consider carrying an umbrella and plan your journey carefully.";
  }

  if ([61, 63, 80, 81].includes(code) || rainChance >= 40) {
    return "🌂 There may be rain today. An umbrella could be useful.";
  }

  const hotTemperature =
    temperatureUnit === "celsius" ? temperature >= 32 : temperature >= 89.6;

  if (hotTemperature) {
    return "🥤 It may be a hot day. Drink water regularly and try to stay in the shade.";
  }

  if (code === 0 || code === 1 || code === 2) {
    return "😊 Conditions look fairly dry. Enjoy your day, and remember to drink water.";
  }

  return "🌤️ Check the forecast again before travelling, as weather conditions can change.";
}

async function findCity(city) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({
    name: city,
    count: "5",
    language: "en",
    format: "json"
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("We could not search for that city. Please try again.");
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error("We could not find that city. Check the spelling and try again.");
  }

  // Prefer a city, town, or populated place from the results.
  const place = data.results.find(item =>
    ["city", "town", "village", "municipality", "administrative"].includes(item.feature_code)
  ) || data.results[0];

  return {
    name: place.name,
    region: place.admin1 || "",
    country: place.country || "",
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone || "auto"
  };
}

async function getWeather(place, requestId) {
  showMessage("⏳ Getting the weather for " + place.name + "...");
  weatherSection.hidden = true;
  searchButton.disabled = true;
  locationButton.disabled = true;

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");

    url.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "precipitation",
        "weather_code",
        "wind_speed_10m"
      ].join(","),
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_probability_max"
      ].join(","),
      temperature_unit: temperatureUnit,
      wind_speed_unit: "kmh",
      forecast_days: "5",
      timezone: place.timezone || "auto"
    });

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("We could not get the weather right now. Please try again.");
    }

    const data = await response.json();

    if (requestId !== requestNumber) return;

    if (!data.current || !data.daily) {
      throw new Error("Weather information is unavailable for this place.");
    }

    currentPlace = place;
    displayWeather(place, data);
    showMessage("✅ Weather updated for " + place.name + ".");
  } catch (error) {
    if (requestId !== requestNumber) return;

    showMessage(
      error.message || "Something went wrong. Check your internet and try again.",
      true
    );
  } finally {
    if (requestId === requestNumber) {
      searchButton.disabled = false;
      locationButton.disabled = false;
    }
  }
}

function displayWeather(place, data) {
  const current = data.current;
  const daily = data.daily;
  const [description, icon] = getWeatherDescription(current.weather_code);
  const todayRainChance = daily.precipitation_probability_max?.[0];

  document.getElementById("city-name").textContent =
    [place.name, place.region, place.country].filter(Boolean).join(", ");

  document.getElementById("local-time").textContent =
    "Current time: " + new Date().toLocaleTimeString();

  const weatherIcon = document.getElementById("weather-icon");
  weatherIcon.textContent = icon;
  weatherIcon.setAttribute("aria-label", description);

  document.getElementById("condition").textContent = description;
  document.getElementById("temperature").textContent =
    Math.round(current.temperature_2m);
  document.getElementById("temperature-unit").textContent = getTemperatureSymbol();

  document.getElementById("feels-like").textContent =
    "Feels like " + formatTemperature(current.apparent_temperature);

  document.getElementById("humidity").textContent =
    current.relative_humidity_2m + "%";

  document.getElementById("wind").textContent =
    Math.round(current.wind_speed_10m) + " km/h";

  document.getElementById("rain").textContent =
    current.precipitation + " mm";

  document.getElementById("rain-chance").textContent =
    todayRainChance == null ? "Unavailable" : todayRainChance + "%";

  document.getElementById("weather-advice").textContent =
    getAdvice(current.weather_code, todayRainChance ?? 0, current.temperature_2m);

  displayForecast(daily);
  weatherSection.hidden = false;
}

function displayForecast(daily) {
  const forecast = document.getElementById("forecast");
  forecast.replaceChildren();

  daily.time.forEach((date, index) => {
    const [description, icon] = getWeatherDescription(daily.weather_code[index]);
    const card = document.createElement("article");
    card.className = "forecast-card";

    const day = document.createElement("h3");
    day.textContent = index === 0 ? "Today" : formatDay(date);

    const weatherIcon = document.createElement("span");
    weatherIcon.className = "forecast-icon";
    weatherIcon.textContent = icon;
    weatherIcon.setAttribute("aria-label", description);
    weatherIcon.setAttribute("role", "img");

    const condition = document.createElement("p");
    condition.textContent = description;

    const highLow = document.createElement("p");
    highLow.textContent =
      Math.round(daily.temperature_2m_max[index]) + "° / " +
      Math.round(daily.temperature_2m_min[index]) + "°";

    const rain = document.createElement("p");
    rain.className = "rain-forecast";

    const chance = daily.precipitation_probability_max[index];
    rain.textContent = chance == null ? "Rain: unavailable" : "Rain: " + chance + "%";

    card.append(day, weatherIcon, condition, highLow, rain);
    forecast.appendChild(card);
  });

  // The daily temperatures also follow the selected unit.
  forecast.querySelectorAll(".forecast-card").forEach((card, index) => {
    const highLow = card.querySelectorAll("p")[1];
    highLow.textContent =
      formatTemperature(daily.temperature_2m_max[index]) + " / " +
      formatTemperature(daily.temperature_2m_min[index]);
  });
}

searchForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const city = cityInput.value.trim();

  if (!city) {
    showMessage("Please enter the name of a city.", true);
    cityInput.focus();
    return;
  }

  const requestId = ++requestNumber;

  try {
    showMessage("🔎 Looking for " + city + "...");
    searchButton.disabled = true;

    const place = await findCity(city);

    if (requestId !== requestNumber) return;

    await getWeather(place, requestId);
  } catch (error) {
    if (requestId !== requestNumber) return;

    showMessage(error.message, true);
    searchButton.disabled = false;
    locationButton.disabled = false;
  }
});

locationButton.addEventListener("click", function () {
  if (!navigator.geolocation) {
    showMessage("Your browser does not support location sharing. Please search for a city instead.", true);
    return;
  }

  const requestId = ++requestNumber;

  showMessage("📍 Asking your browser for your location...");
  searchButton.disabled = true;
  locationButton.disabled = true;

  navigator.geolocation.getCurrentPosition(
    async function (position) {
      if (requestId !== requestNumber) return;

      const place = {
        name: "Your location",
        region: "",
        country: "",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timezone: "auto"
      };

      await getWeather(place, requestId);
    },
    function (error) {
      if (requestId !== requestNumber) return;

      let explanation = "We could not access your location. Please search for a city instead.";

      if (error.code === error.PERMISSION_DENIED) {
        explanation = "Location permission was not given. No problem — you can search for a city instead.";
      } else if (error.code === error.TIMEOUT) {
        explanation = "Finding your location took too long. Please try again or search for a city.";
      }

      showMessage(explanation, true);
      searchButton.disabled = false;
      locationButton.disabled = false;
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000
    }
  );
});

unitButton.addEventListener("click", async function () {
  temperatureUnit = temperatureUnit === "celsius" ? "fahrenheit" : "celsius";
  unitButton.textContent =
    temperatureUnit === "celsius" ? "°C / °F" : "°F / °C";

  if (currentPlace) {
    const requestId = ++requestNumber;
    await getWeather(currentPlace, requestId);
  }
});

// Start with a useful example city, so the app is not empty.
(async function startApp() {
  const requestId = ++requestNumber;

  try {
    const place = await findCity("Lagos");
    if (requestId === requestNumber) {
      await getWeather(place, requestId);
    }
  } catch {
    showMessage("Welcome! Search for a city to check its weather.");
    searchButton.disabled = false;
    locationButton.disabled = false;
  }
})();
