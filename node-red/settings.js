module.exports = {

    uiPort: process.env.PORT || 1880,

    uiHost: "0.0.0.0",

    flowFile: "flows.json",

    httpNodeRoot: "/",

    // En producción no necesitamos
    // exponer el editor de Node-RED.
    httpAdminRoot: false,

    functionGlobalContext: {}
};