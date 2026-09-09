package com.company.departmentsteward;

import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.widget.ProgressBar;
import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

final class VerifiedUpdater {
    private final MainActivity activity;
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private volatile boolean cancelled;
    private volatile HttpURLConnection activeConnection;
    private long lastCheck;
    private File verified;
    private long verifiedVersion;
    private boolean awaitingPermission;
    VerifiedUpdater(MainActivity activity) { this.activity = activity; }
    private String base() throws Exception {
        try (InputStream in = activity.getAssets().open("public/service-config.json")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buffer = new byte[1024]; int n;
            while ((n = in.read(buffer)) != -1) { out.write(buffer, 0, n); if (out.size() > 16384) throw new IOException("服务配置过大"); }
            JSONObject config = new JSONObject(out.toString("UTF-8"));
            return UpdatePolicy.origin(config.getString("origin"));
        }
    }
    private long installedVersion() throws Exception { return PackageInfoCompat.getLongVersionCode(activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0)); }
    private void ui(Runnable action) { activity.runOnUiThread(() -> { if (!activity.isFinishing() && !activity.isDestroyed()) action.run(); }); }
    private void message(String text) { ui(() -> new AlertDialog.Builder(activity).setTitle("APP 更新").setMessage(text).setPositiveButton("知道了", null).show()); }
    private HttpURLConnection open(String address) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setConnectTimeout(8000); connection.setReadTimeout(10000); connection.setInstanceFollowRedirects(false); connection.setUseCaches(false);
        activeConnection = connection;
        if (connection.getResponseCode() != 200) { connection.disconnect(); throw new IOException("服务返回非 200 响应，请检查网络后重试"); }
        return connection;
    }
    void check(boolean manual) {
        if (awaitingPermission) return;
        if (!manual && System.currentTimeMillis() - lastCheck < 60000) return;
        if (!busy.compareAndSet(false, true)) { if (manual) message("正在检查或下载，请稍候。"); return; }
        lastCheck = System.currentTimeMillis();
        new Thread(() -> {
            try {
                String origin = base(); HttpURLConnection connection = open(origin + "/downloads/android.json");
                String body;
                try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[4096]; int n;
                    while ((n = in.read(buffer)) != -1) { out.write(buffer, 0, n); if (out.size() > 16384) throw new IOException("更新信息过大"); }
                    body = out.toString("UTF-8");
                } finally { connection.disconnect(); }
                JSONObject release = new JSONObject(body);
                long version = release.getLong("versionCode"), installed = installedVersion();
                if (version <= installed) { if (manual) message("当前已是最新版本。"); return; }
                UpdatePolicy.manifest(version, installed, release.getString("path"), release.getLong("size"), release.getString("sha256"));
                ui(() -> new AlertDialog.Builder(activity).setTitle("部门小管家新版本 " + release.optString("versionName"))
                    .setMessage(release.optString("notes") + "\n\n下载后先校验安装包及签名，再由安卓系统确认覆盖安装。无需卸载旧版。")
                    .setNegativeButton("稍后再说", null).setPositiveButton("下载并校验", (d, w) -> download(origin, release)).show());
            } catch (Exception error) { if (manual) message("检查更新失败：" + error.getMessage() + "。请检查公司 Wi-Fi/VPN 后重试。"); }
            finally { activeConnection = null; busy.set(false); }
        }, "business-update-check").start();
    }
    private void download(String origin, JSONObject release) {
        if (!busy.compareAndSet(false, true)) return;
        cancelled = false;
        ProgressBar progress = new ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal); progress.setMax(100);
        AlertDialog dialog = new AlertDialog.Builder(activity).setTitle("下载并验证更新").setView(progress).setCancelable(false)
            .setNegativeButton("取消下载", (d, w) -> { cancelled = true; HttpURLConnection c = activeConnection; if (c != null) c.disconnect(); }).create();
        dialog.show();
        new Thread(() -> {
            File file = new File(activity.getCacheDir(), "updates/candidate.apk");
            try {
                if (!file.getParentFile().isDirectory() && !file.getParentFile().mkdirs()) throw new IOException("无法创建更新缓存目录");
                long expected = release.getLong("size"), total = 0;
                MessageDigest hash = MessageDigest.getInstance("SHA-256");
                HttpURLConnection connection = open(origin + release.getString("path"));
                try (InputStream in = connection.getInputStream(); OutputStream out = new FileOutputStream(file)) {
                    byte[] buffer = new byte[32768]; int n, previous = -1;
                    while ((n = in.read(buffer)) != -1) {
                        if (cancelled) throw new IOException("已取消下载");
                        total += n; if (total > expected) throw new IOException("安装包超过声明大小");
                        out.write(buffer, 0, n); hash.update(buffer, 0, n);
                        int percent = (int)(total * 100 / expected);
                        if (percent != previous) { previous = percent; ui(() -> progress.setProgress(percent)); }
                    }
                } finally { connection.disconnect(); }
                if (cancelled) throw new IOException("已取消下载");
                UpdatePolicy.bytes(total, expected, hex(hash.digest()), release.getString("sha256"));
                verifiedVersion = release.getLong("versionCode"); verifyPackage(file, verifiedVersion);
                verified = file;
                ui(() -> { dialog.dismiss(); confirmInstall(); });
            } catch (Exception error) {
                // Only our own incomplete update cache is removed. Never touch app databases or user files.
                if (file.exists()) file.delete(); verified = null;
                ui(() -> { dialog.dismiss(); message(cancelled ? "已取消下载，未安装或清除业务数据。" : "更新失败：" + error.getMessage() + "。可重新检查更新并重试。"); });
            } finally { activeConnection = null; busy.set(false); }
        }, "business-update-download").start();
    }
    private static String hex(byte[] bytes) { StringBuilder b = new StringBuilder(); for (byte v : bytes) b.append(String.format(Locale.ROOT, "%02x", v & 255)); return b.toString(); }
    private static Set<String> signers(PackageInfo info) throws Exception {
        Set<String> result = new TreeSet<>();
        Signature[] certificates = android.os.Build.VERSION.SDK_INT >= 28 && info.signingInfo != null ? info.signingInfo.getApkContentsSigners() : info.signatures;
        if (certificates == null) throw new IOException("无法读取 APK 签名");
        for (Signature signature : certificates) result.add(hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));
        if (result.isEmpty()) throw new IOException("APK 没有有效签名"); return result;
    }
    private void verifyPackage(File file, long version) throws Exception {
        PackageManager manager = activity.getPackageManager();
        int flags = android.os.Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo candidate = manager.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        PackageInfo installed = manager.getPackageInfo(activity.getPackageName(), flags);
        if (candidate == null || !activity.getPackageName().equals(candidate.packageName) || PackageInfoCompat.getLongVersionCode(candidate) != version || version <= PackageInfoCompat.getLongVersionCode(installed)) throw new IOException("APK 包名或版本不匹配");
        if (!signers(candidate).equals(signers(installed))) throw new IOException("APK 签名与当前版本不同，拒绝覆盖安装");
    }
    private void confirmInstall() {
        new AlertDialog.Builder(activity).setTitle("更新包已验证").setMessage("大小、SHA256、包名、版本及签名已验证。继续后由安卓系统确认安装，取消不会卸载旧版。")
            .setNegativeButton("暂不安装", null).setPositiveButton("继续安装", (d, w) -> install()).show();
    }
    private void install() {
        try {
            if (verified == null) throw new IOException("安装缓存不可用，请重新下载");
            verifyPackage(verified, verifiedVersion);
            if (android.os.Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
                awaitingPermission = true;
                activity.startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()))); return;
            }
            Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", verified);
            activity.startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
        } catch (Exception error) { message("无法启动安装：" + error.getMessage()); }
    }
    void resumed() {
        if (awaitingPermission) { awaitingPermission = false; if (activity.getPackageManager().canRequestPackageInstalls()) confirmInstall(); else message("未允许安装未知来源应用，尚未安装。可以稍后重新检查更新。"); }
        else check(false);
    }
    void destroy() { cancelled = true; HttpURLConnection c = activeConnection; if (c != null) c.disconnect(); }
}
