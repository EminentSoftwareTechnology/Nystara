type Event = "admin_login" | "password_change" | "role_change" | "account_erasure" | "data_export";

export function audit(event: Event, outcome: "success" | "denied") {
  console.info(JSON.stringify({ event, outcome, timestamp: new Date().toISOString() }));
}
