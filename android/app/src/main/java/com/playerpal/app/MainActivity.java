package com.somalux.app;

import android.os.Build;
import android.view.View;
import android.webkit.WebView;
import android.view.LayoutInflater;
import android.widget.FrameLayout;
import android.os.Handler;
import android.os.Looper;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.somalux.app.plugins.NativePdfRendererPlugin;
import com.somalux.app.plugins.SystemBarsPlugin;

public class MainActivity extends BridgeActivity {
    private View splashView;

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(SystemBarsPlugin.class);
        registerPlugin(NativePdfRendererPlugin.class);
        super.onCreate(savedInstanceState);

        showPaltechSplash();
        applySystemBarsFromAndroidTheme();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
    }

    private void showPaltechSplash() {
        splashView = LayoutInflater.from(this).inflate(R.layout.splash_screen, null);
        View content = getWindow().getDecorView().findViewById(android.R.id.content);
        if (content instanceof FrameLayout) {
            ((FrameLayout) content).addView(splashView);
        }
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (splashView != null && splashView.getParent() instanceof FrameLayout) {
                ((FrameLayout) splashView.getParent()).removeView(splashView);
            }
        }, 1500);
    }

    @Override
    public void onResume() {
        super.onResume();

        // Hide navigation bar buttons and make them overlay the app
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            View decorView = getWindow().getDecorView();
            int flags = decorView.getSystemUiVisibility();
            flags |= View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
            flags |= View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            decorView.setSystemUiVisibility(flags);
        }

        applySystemBarsFromAndroidTheme();
        new Handler(Looper.getMainLooper()).postDelayed(
            this::applySystemBarsFromAndroidTheme, 250
        );
        
    }

    private void applySystemBarsFromAndroidTheme() {
        String mode = getSharedPreferences("theme", MODE_PRIVATE).getString("mode", "system");
        boolean light = "light".equals(mode)
            || ("system".equals(mode) && (getResources().getConfiguration().uiMode
            & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_NO);

        int background = light ? 0xFFFFFFFF : 0xFF0C1317;
        getWindow().setBackgroundDrawable(new ColorDrawable(background));
        getWindow().setStatusBarColor(background);
        getWindow().setNavigationBarColor(background);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }

        WindowInsetsControllerCompat controller =
            new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(light);
        controller.setAppearanceLightNavigationBars(light);
    }
}
