import GLib from "gi://GLib?version=2.0";

export const currentMicrosecond = () => {
  const now = GLib.DateTime.new_now_local();
  return now.to_unix() * 1000000 + now.get_microsecond();
};
