package com.company.departmentsteward;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private VerifiedUpdater updater;
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AttachmentFilesPlugin.class);
        registerPlugin(AppUpdatesPlugin.class);
        super.onCreate(savedInstanceState);
        updater = new VerifiedUpdater(this);
        getOnBackPressedDispatcher().addCallback(this, new androidx.activity.OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (getBridge() == null || getBridge().getWebView() == null) { moveTaskToBack(true); return; }
                getBridge().getWebView().evaluateJavascript(
                    "window.dispatchEvent(new Event('bam-native-back',{cancelable:true}))",
                    result -> { if (!"false".equals(result)) moveTaskToBack(true); });
            }
        });
    }
    public void checkUpdates() { if (updater != null) updater.check(true); }
    @Override public void onResume() { super.onResume(); if (updater != null) updater.resumed(); }
    @Override public void onDestroy() { if (updater != null) updater.destroy(); super.onDestroy(); }
}
