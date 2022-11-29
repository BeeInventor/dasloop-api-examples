const mqtt = require("mqtt");

const username = process.env.DASLOOP_USERNAME;
const password = process.env.DASLOOP_PASSWORD;
const projectId = process.env.DASLOOP_PROJECT_ID;
const oidcEndpoint = process.env.DASLOOP_OIDC_ENDPOINT || "https://oidc.dasloop.com/token";
const apiEndpoint = process.env.DASLOOP_API_ENDPOINT || "https://api.dasloop.com";
const mqttEndpoint = process.env.DASLOOP_MQTT_ENDPOINT || "wss://mqtt.dasloop.com/mqtt";

const clientId = username + "-" + new Date().getTime(); // use a unique clientId
var mqttClient;

async function delay(ms) {
    return new Promise(function (resolve, reject) {
        setInterval(function () {
            resolve();
        }, ms)
    });
}

async function getToken() {
    try {
        const res = await fetch(oidcEndpoint, {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
            body: [
                "grant_type=password",
                "client_id=application",
                "username=" + encodeURIComponent(username),
                "password=" + encodeURIComponent(password),
            ].join("&")
        });

        if (res.ok) {
            const json = await res.json();
            const token = json.access_token;
            const userId = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("ascii")).sub;

            return {
                userId,
                token,
            }
        }
        console.error(new Date().toISOString() + "getToken() error: " + await res.text());
    } catch (err) {
        console.error(new Date().toISOString() + "getToken() error: " + err);
    }

    // retry after a delay
    await delay(3000);
    return getToken();
}

async function getProjects(token) {
    try {
        const res = await fetch(apiEndpoint + "/v2/projects", {
            headers: {
                authorization: "Bearer " + token
            }
        });

        if (res.ok) {
            return res.json();
        }

        console.error(new Date().toISOString() + "getProjects() error: " + await res.text());
    } catch (err) {
        console.error(new Date().toISOString() + "getProjects() error: " + err);
    }

    // retry after a delay
    await delay(3000);
    return getProjects(token);
}

function onMqttConnect() {
    console.log(new Date().toISOString() + " MQTT connected, clientId " + clientId);
}

function onMqttError(err) {
    console.error(new Date().toISOString() + "MQTT error: " + err);
}

function onMqttMessage(topic, message, packet) {
    console.log(new Date().toISOString() + " Received msg of topic " + topic);
}

function onMqttClose() {
    console.log(new Date().toISOString() + " MQTT connection closed. Reconnecting...");
    connectMqtt()
}

async function connectMqtt() {
    const { userId, token } = await getToken();
    console.log(new Date().toISOString() + " Got token with userId " + userId);
    const projects = await getProjects(token);

    const project = projects.find(p => p.id == projectId);
    console.log(new Date().toISOString() + " Subscribing to device updates of project " + project.name + " (" + project.id + ")");

    mqttClient = mqtt.connect(mqttEndpoint, {
        username: "dasloop/" + userId,
        clientId: clientId,
        password: token,
        reconnectPeriod: 0, // disable auto-reconnect, because the token is likely expired, we need to use a new token
    });
    mqttClient.on("error", onMqttError);
    mqttClient.on("connect", onMqttConnect);
    mqttClient.on("message", onMqttMessage);
    mqttClient.on("close", onMqttClose)
    mqttClient.subscribe("v1/json/projects/" + project.id + "/device_updates");
}

connectMqtt();
