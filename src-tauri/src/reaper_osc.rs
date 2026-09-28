use serde::Serialize;
use std::net::UdpSocket;

const ENABLE_ENV: &str = "AERA_REAPER_OSC_ENABLED";
const PORT_ENV: &str = "AERA_REAPER_OSC_PORT";
const DEFAULT_PORT: u16 = 8000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaperOscStatus {
    pub enabled: bool,
    pub port: u16,
    pub address: String,
}

fn enabled() -> bool {
    std::env::var(ENABLE_ENV)
        .map(|value| matches!(value.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
        .unwrap_or(false)
}

fn port() -> u16 {
    std::env::var(PORT_ENV)
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_PORT)
}

pub fn status() -> ReaperOscStatus {
    let port = port();
    ReaperOscStatus {
        enabled: enabled(),
        port,
        address: format!("127.0.0.1:{port}"),
    }
}

fn osc_string(value: &str) -> Vec<u8> {
    let mut bytes = value.as_bytes().to_vec();
    bytes.push(0);
    while bytes.len() % 4 != 0 {
        bytes.push(0);
    }
    bytes
}

fn trigger_packet(address: &str) -> Vec<u8> {
    let mut packet = osc_string(address);
    packet.extend(osc_string(","));
    packet
}

fn send_trigger(address: &str) -> Result<(), String> {
    if !enabled() {
        return Err(
            "REAPER OSC is disabled. Configure REAPER's OSC control surface and set AERA_REAPER_OSC_ENABLED=1."
                .into(),
        );
    }

    let port = port();
    let socket = UdpSocket::bind("127.0.0.1:0")
        .map_err(|error| format!("Could not create local OSC socket: {error}"))?;
    socket
        .send_to(&trigger_packet(address), ("127.0.0.1", port))
        .map_err(|error| format!("Could not send REAPER OSC command: {error}"))?;

    Ok(())
}

pub fn transport(action: &str) -> Result<(), String> {
    let address = match action {
        "play" => "/play",
        "stop" => "/stop",
        "pause" => "/pause",
        _ => return Err("Unsupported REAPER transport action.".into()),
    };

    send_trigger(address)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trigger_packets_are_valid_osc_shape() {
        let packet = trigger_packet("/play");
        assert_eq!(&packet[0..8], b"/play\0\0\0");
        assert_eq!(&packet[8..12], b",\0\0\0");
        assert_eq!(packet.len() % 4, 0);
    }

    #[test]
    fn unsupported_transport_is_rejected() {
        assert!(transport("delete-project").is_err());
    }
}
