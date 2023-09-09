import type { ConfigFacade } from "./config";

export const preloadGiLibs = async (config: ConfigFacade) => {
  if (config.introspectedLibVersion) {
    const v = config.introspectedLibVersion;

    if (v.atk) {
      await import("gi://Atk?version=" + v.atk);
    }

    if (v.gmodule) {
      await import("gi://GModule?version=" + v.gmodule);
    }

    if (v.gobject) {
      await import("gi://GObject?version=" + v.gobject);
    }

    if (v.gdk) {
      await import("gi://Gdk?version=" + v.gdk);
    }

    if (v.gdkPixbuf) {
      await import("gi://GdkPixbuf?version=" + v.gdkPixbuf);
    }

    if (v.graphene) {
      await import("gi://Graphene?version=" + v.graphene);
    }

    if (v.gsk) {
      await import("gi://Gsk?version=" + v.gsk);
    }

    if (v.gtk) {
      await import("gi://Gtk?version=" + v.gtk);
    }

    if (v.harfbuzz) {
      await import("gi://Harfbuzz?version=" + v.harfbuzz);
    }

    if (v.pango) {
      await import("gi://Pango?version=" + v.pango);
    }

    if (v.pangoCairo) {
      await import("gi://PangoCairo?version=" + v.pangoCairo);
    }

    if (v.soup) {
      await import("gi://Soup?version=" + v.soup);
    }

    if (v.cairo) {
      await import("gi://Cairo?version=" + v.cairo);
    }

    if (v.xlib) {
      await import("gi://Xlib?version=" + v.xlib);
    }
  }
};
