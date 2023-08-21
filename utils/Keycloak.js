const Keycloak = require('keycloak-backend').Keycloak
const keycloak = new Keycloak({
    realm: process.env.KEYCLOAK_REALM,
    keycloak_base_url: process.env.KEYCLOAK_BASE_URL,
    client_id: process.env.KEYCLOAK_AUTH_CLIENT_ID,
    client_secret: process.env.KEYCLOAK_AUTH_CLIENT_SECRET,
})

module.exports = keycloak
