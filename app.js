// ══════════════════════════════════════════════════════════
// CONFIGURACIÓN DE LAS APIs
// ══════════════════════════════════════════════════════════
const API_KEY = 'c88860278d6bdd87a8d7e34b26bd5d8e';
const BASE_URL = 'https://api.openweathermap.org';

const ENDPOINTS = {
    geo: (query) => `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=10&accept-language=es`,
    current: (lat, lon) => `${BASE_URL}/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=es&appid=${API_KEY}`,
    forecast: (lat, lon) => `${BASE_URL}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=es&appid=${API_KEY}`,
    icon: (code) => `https://openweathermap.org/img/wn/${code}@4x.png` 
};

// ══════════════════════════════════════════════════════════
// ELEMENTOS DEL DOM
// ══════════════════════════════════════════════════════════
const searchInput = document.getElementById('search-input');
const suggestionsList = document.getElementById('suggestions-list');
const locationBtn = document.getElementById('location-btn');
const mainContent = document.getElementById('main-content');

// ══════════════════════════════════════════════════════════
// LÓGICA DEL BUSCADOR EN VIVO (AUTOCOMPLETADO AVANZADO)
// ══════════════════════════════════════════════════════════
let debounceTimer;

// 1. Evento mientras escribes
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    clearTimeout(debounceTimer);
    
    // Si la barra está vacía, solo ocultamos las sugerencias, NO borramos el clima
    if (query.length === 0) {
        suggestionsList.innerHTML = '';
        suggestionsList.classList.add('hidden');
        return;
    }

    if (query.length < 3) {
        suggestionsList.innerHTML = '';
        suggestionsList.classList.add('hidden');
        return;
    }

    debounceTimer = setTimeout(() => fetchSuggestions(query), 400);
});

// 2. NUEVO: Evento al presionar Enter
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        
        // Si presionas Enter y la barra está vacía, ENTONCES reseteamos la app
        if (query.length === 0) {
            suggestionsList.innerHTML = '';
            suggestionsList.classList.add('hidden');
            showDefaultState();
        }
    }
});

async function fetchSuggestions(query) {
    try {
        const res = await fetch(ENDPOINTS.geo(query));
        const data = await res.json();
        
        suggestionsList.innerHTML = ''; 
        
        if (data.length === 0) {
            suggestionsList.innerHTML = `<li style="color: #ccc; justify-content: center;">No se encontraron resultados</li>`;
        } else {
            data.forEach(place => {
                const li = document.createElement('li');
                
                const mainName = place.name || place.address?.city || place.address?.country || 'Ubicación';
                const state = place.address?.state ? `, ${place.address.state}` : '';
                const country = place.address?.country || '';

                li.innerHTML = `
                    <span>📍 ${mainName}${state}</span>
                    <span class="country-tag">${country}</span>
                `;
                
                li.addEventListener('click', () => {
                    searchInput.value = ''; 
                    suggestionsList.classList.add('hidden'); 
                    fetchWeatherData(parseFloat(place.lat), parseFloat(place.lon), mainName);
                });
                
                suggestionsList.appendChild(li);
            });
        }
        suggestionsList.classList.remove('hidden');
    } catch (error) {
        console.error("Error al buscar lugares:", error);
    }
}

// Ocultar dropdown si se hace click fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        suggestionsList.classList.add('hidden');
    }
});

// ══════════════════════════════════════════════════════════
// LÓGICA PRINCIPAL DEL CLIMA
// ══════════════════════════════════════════════════════════
async function fetchWeatherData(lat, lon, cityName = null) {
    showLoading();
    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetch(ENDPOINTS.current(lat, lon)),
            fetch(ENDPOINTS.forecast(lat, lon))
        ]);

        if (!currentRes.ok || !forecastRes.ok) throw new Error("Error obteniendo datos del clima.");

        const currentData = await currentRes.json();
        const forecastData = await forecastRes.json();

        const finalCityName = cityName || currentData.name;

        renderDashboard(currentData, forecastData, finalCityName);
        
        localStorage.setItem('last_lat', lat);
        localStorage.setItem('last_lon', lon);
        localStorage.setItem('last_city', finalCityName);

    } catch (error) {
        showError(error.message);
    }
}

locationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) return showError("Tu navegador no soporta geolocalización.");
    
    showLoading();
    navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeatherData(pos.coords.latitude, pos.coords.longitude),
        () => showError("Permiso de ubicación denegado. Busca tu ciudad manualmente.")
    );
});

// ══════════════════════════════════════════════════════════
// RENDERIZADO DE LA INTERFAZ (UI)
// ══════════════════════════════════════════════════════════
function renderDashboard(current, forecast, cityName) {
    const { sys, main, weather, wind, visibility, dt } = current;
    const condition = weather[0];
    const isDay = dt > sys.sunrise && dt < sys.sunset;
    
    document.body.style.background = getBackground(condition.id, isDay);

    const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    const formattedDate = new Date(dt * 1000).toLocaleDateString('es-ES', dateOptions);

    const dailyForecast = forecast.list.filter(item => item.dt_txt.includes('12:00:00')).slice(0, 5);

    mainContent.innerHTML = `
        <div class="dashboard-grid">
            <section class="current-weather-card">
                <h2 class="city-title">${cityName}, ${sys.country || ''}</h2>
                <p class="date-text">${capitalizar(formattedDate)}</p>
                
                <img src="${ENDPOINTS.icon(condition.icon)}" alt="${condition.description}" class="weather-main-icon" />
                
                <div class="temp-huge">${Math.round(main.temp)}°</div>
                <div class="condition-desc">${condition.description}</div>
            </section>

            <section class="right-panel">
                <div class="details-grid">
                    <div class="detail-card">
                        <div class="detail-icon">🌡️</div>
                        <div class="detail-info">
                            <p>Sensación</p>
                            <h4>${Math.round(main.feels_like)}°C</h4>
                        </div>
                    </div>
                    <div class="detail-card">
                        <div class="detail-icon">💧</div>
                        <div class="detail-info">
                            <p>Humedad</p>
                            <h4>${main.humidity}%</h4>
                        </div>
                    </div>
                    <div class="detail-card">
                        <div class="detail-icon">🌬️</div>
                        <div class="detail-info">
                            <p>Viento</p>
                            <h4>${Math.round(wind.speed * 3.6)} km/h</h4>
                        </div>
                    </div>
                    <div class="detail-card">
                        <div class="detail-icon">👁️</div>
                        <div class="detail-info">
                            <p>Visibilidad</p>
                            <h4>${(visibility / 1000).toFixed(1)} km</h4>
                        </div>
                    </div>
                </div>

                <div class="forecast-section">
                    <h3>Pronóstico de 5 días</h3>
                    <div class="forecast-flex">
                        ${dailyForecast.map(day => `
                            <div class="day-card">
                                <p>${new Date(day.dt * 1000).toLocaleDateString('es-ES', { weekday: 'short' })}</p>
                                <img src="${ENDPOINTS.icon(day.weather[0].icon)}" alt="${day.weather[0].description}">
                                <div class="temps">
                                    <span>${Math.round(day.main.temp_max)}°</span>
                                    <span class="min">${Math.round(day.main.temp_min)}°</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </section>
        </div>
    `;
}

// ══════════════════════════════════════════════════════════
// HELPERS Y ESTADOS
// ══════════════════════════════════════════════════════════
function getBackground(id, isDay) {
    if (!isDay) return 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)'; 
    if (id >= 200 && id < 600) return 'linear-gradient(135deg, #3a7bd5 0%, #3a6073 100%)'; 
    if (id === 800) return 'linear-gradient(135deg, #2980B9 0%, #6DD5FA 50%, #FFFFFF 100%)'; 
    return 'linear-gradient(135deg, #757F9A 0%, #D7DDE8 100%)'; 
}

function capitalizar(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function showLoading() {
    mainContent.innerHTML = `
        <div class="empty-state">
            <div class="spinner"></div>
            <h2>Obteniendo clima...</h2>
        </div>
    `;
}

function showError(msg) {
    mainContent.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon" style="animation:none">⚠️</div>
            <h2>Algo salió mal</h2>
            <p>${msg}</p>
        </div>
    `;
}

// Función que resetea la vista a la bienvenida
function showDefaultState() {
    document.body.style.background = 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)';
    
    mainContent.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">🌤️</div>
            <h2>Bienvenido</h2>
            <p>Busca una ciudad o permite el acceso a tu ubicación para ver el clima.</p>
        </div>
    `;

    localStorage.removeItem('last_lat');
    localStorage.removeItem('last_lon');
    localStorage.removeItem('last_city');
}

window.addEventListener('DOMContentLoaded', () => {
    const lastLat = localStorage.getItem('last_lat');
    const lastLon = localStorage.getItem('last_lon');
    const lastCity = localStorage.getItem('last_city');

    if (lastLat && lastLon) {
        fetchWeatherData(lastLat, lastLon, lastCity);
    } else {
        showDefaultState();
    }
});

// Actualizar el año del footer automáticamente
document.getElementById('year').textContent = new Date().getFullYear();