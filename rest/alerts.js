const username = process.env.DASLOOP_USERNAME;
const password = process.env.DASLOOP_PASSWORD;
const projectId = process.env.DASLOOP_PROJECT_ID;
const oidcEndpoint = process.env.DASLOOP_OIDC_ENDPOINT || "https://oidc.dasloop.com/token";
const apiEndpoint = process.env.DASLOOP_API_ENDPOINT || "https://api.dasloop.com";

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
        console.error(new Date().toISOString() + " getToken() error: " + await res.text());
    } catch (err) {
        console.error(new Date().toISOString() + " getToken() error: " + err);
    }

    // retry after a delay
    await delay(3000);
    return getToken();
}

async function getDeviceAlerts(token, deviceId) {
    try {
        const res = await fetch(apiEndpoint + "/devices/" + deviceId + "/alerts", {
            headers: {
                authorization: "Bearer " + token
            }
        });

        if (res.ok) {
            return res.json();
        }

        console.error(new Date().toISOString() + " getDeviceAlerts() error: " + await res.text());
    } catch (err) {
        console.error(new Date().toISOString() + " getDeviceAlerts() error: " + err);
    }

    // retry after a delay
    await delay(3000);
    return getDeviceAlerts(token);
}

async function main() {
    const deviceId = process.argv[2];
    if (!deviceId) {
        console.error("Expect a single command argument of deviceId");
        process.exit(1);
    }

    const { userId, token } = await getToken();
    console.log(new Date().toISOString() + " Got token with userId " + userId);

    const alerts = await getDeviceAlerts(token, deviceId);
    console.log(alerts);
}

main();
