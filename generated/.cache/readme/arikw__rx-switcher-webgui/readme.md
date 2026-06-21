# RX Switcher Web GUI

This project is a web GUI for the Switcher Water Heater touch device. It is designed to work with [switcher_webapi](https://github.com/TomerFi/switcher_webapi) as the backend.

![Screenshot](images/screenshot.png)

## Configuration

Copy the `.env.example` file to `.env` and configure the environment variables according to your setup.

> **Note:** This project has been tested with a Switcher device assigned a fixed LAN IP.

## How to run

Clone the repo, configure using the `.env` and run `vite`
_Or_
Run the following command:

```
docker build -t rx-switcher-webgui \
  --build-arg VITE_DEVICE_IP=$DEVICE_IP \
  --build-arg VITE_DEVICE_ID=$DEVICE_ID \
  --build-arg VITE_DEVICE_KEY=$DEVICE_KEY \
  --build-arg VITE_DEVICE_TYPE=touch \
  --build-arg VITE_REFRESH_INTERVAL=5000 \
  https://github.com/arikw/rx-switcher-webgui.git#master

docker run --name switcher_webgui \
  -p 80:5173 \
  -e VITE_PROXY_TARGET=http://localhost:8000 \
  rx-switcher-webgui
```

(Check out the .env.example file for details)

### Useful script to find the broadcast with the switcher's device id and key

`docker run --rm --net=host -it --name aioswitcher python:alpine sh -c 'apk add git bash && git clone https://github.com/TomerFi/aioswitcher.git && cd aioswitcher/ && pip install -r requirements.txt && pip install aioswitcher && python scripts/discover_devices.py'`
