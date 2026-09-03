package com.somalux.app.plugins;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {
    @PluginMethod
    public void setTheme(PluginCall call) {
        String theme = call.getString("theme", "dark");
        getContext().getSharedPreferences("theme", 0).edit().putString("mode", theme).apply();
        boolean light = "light".equals(theme);
        Activity activity = getActivity();
        activity.runOnUiThread(() -> applyTheme(activity.getWindow(), light));

        JSObject result = new JSObject();
        result.put("theme", light ? "light" : "dark");
        call.resolve(result);
    }

    private void applyTheme(Window window, boolean light) {
        int background = Color.parseColor(light ? "#FFFFFF" : "#0C1317");
        window.setStatusBarColor(background);
        window.setNavigationBarColor(background);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }

        View decorView = window.getDecorView();
        int flags = decorView.getSystemUiVisibility();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = light
                ? flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                : flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags = light
                ? flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                : flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        decorView.setSystemUiVisibility(flags);
    }
}
