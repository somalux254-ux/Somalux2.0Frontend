package com.somalux.app.plugins;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;

import androidx.core.view.WindowInsetsControllerCompat;
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
        activity.runOnUiThread(() -> {
            applyTheme(activity.getWindow(), light);
            new Handler(Looper.getMainLooper()).postDelayed(
                () -> applyTheme(activity.getWindow(), light), 250
            );
        });

        JSObject result = new JSObject();
        result.put("theme", light ? "light" : "dark");
        call.resolve(result);
    }

    private void applyTheme(Window window, boolean light) {
        int background = Color.parseColor(light ? "#FFFFFF" : "#0C1317");
        window.setBackgroundDrawable(new ColorDrawable(background));
        window.setStatusBarColor(background);
        window.setNavigationBarColor(background);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }

        WindowInsetsControllerCompat controller =
            new WindowInsetsControllerCompat(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(light);
        controller.setAppearanceLightNavigationBars(light);
    }
}
