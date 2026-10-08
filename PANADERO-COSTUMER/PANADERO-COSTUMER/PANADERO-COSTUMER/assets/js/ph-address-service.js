(function () {
    'use strict';

    const BASE = 'https://psgc.cloud/api/v2';
    const cache = new Map();

    async function request(path) {
        if (cache.has(path)) return cache.get(path);
        const promise = fetch(BASE + path, { headers: { Accept: 'application/json' } })
            .then(function (response) {
                if (!response.ok) throw new Error('Unable to load Philippine address data.');
                return response.json();
            })
            .then(function (data) {
                const list = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
                return list.slice().sort(function (a, b) {
                    return String(a.name || '').localeCompare(String(b.name || ''));
                });
            });
        cache.set(path, promise);
        try {
            return await promise;
        } catch (error) {
            cache.delete(path);
            throw error;
        }
    }

    function safe(value) {
        return encodeURIComponent(String(value || ''));
    }

    window.PHAddressService = {
        getRegions: function () { return request('/regions'); },
        getProvinces: function (regionCode) { return request('/regions/' + safe(regionCode) + '/provinces'); },
        getCitiesMunicipalitiesByRegion: function (regionCode) { return request('/regions/' + safe(regionCode) + '/cities-municipalities'); },
        getCitiesMunicipalitiesByProvince: function (provinceCode) { return request('/provinces/' + safe(provinceCode) + '/cities-municipalities'); },
        getBarangays: function (cityMunicipalityCode) { return request('/cities-municipalities/' + safe(cityMunicipalityCode) + '/barangays'); }
    };
})();
