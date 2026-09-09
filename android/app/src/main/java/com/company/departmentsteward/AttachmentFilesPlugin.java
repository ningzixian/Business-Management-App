package com.company.departmentsteward;

import android.app.Activity;
import android.content.Intent;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.security.MessageDigest;

@CapacitorPlugin(name = "AttachmentFiles")
public class AttachmentFilesPlugin extends Plugin {
    private volatile boolean saving = false;
    private byte[] pendingBytes;

    @PluginMethod
    public synchronized void save(PluginCall call) {
        if (saving) { call.reject("已有附件正在保存"); return; }
        String data = call.getString("base64", "");
        if (data.isEmpty() || data.length() > 28 * 1024 * 1024) { call.reject("附件为空或超限"); return; }
        saving = true;
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            if (bytes.length == 0 || bytes.length > 20 * 1024 * 1024) throw new Exception("文件大小异常");
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b & 0xff));
            if (!hex.toString().equals(call.getString("checksum", ""))) throw new Exception("附件校验失败");
            pendingBytes = bytes;
        } catch (Exception error) { saving = false; call.reject("附件校验失败，未创建文件", error); return; }
        // Capacitor serializes pending call options into saved instance state.
        // Never put a multi-megabyte attachment into Android's small Binder bundle.
        call.getData().remove("base64");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mime", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("name", "附件").replaceAll("[\\\\/\\r\\n]", "_"));
        getActivity().runOnUiThread(() -> {
            try { startActivityForResult(call, intent, "savedLocation"); }
            catch (Exception error) { pendingBytes = null; saving = false; call.reject("无法打开系统文件保存器", error); }
        });
    }

    @ActivityCallback
    private void savedLocation(PluginCall call, ActivityResult result) {
        if (call == null) { pendingBytes = null; saving = false; return; }
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            pendingBytes = null; saving = false; call.resolve(new JSObject().put("cancelled", true)); return;
        }
        final android.net.Uri uri = result.getData().getData();
        new Thread(() -> {
            try {
                byte[] bytes = pendingBytes;
                if (bytes == null) throw new Exception("应用已重启，请重新下载附件");
                try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (stream == null) throw new Exception("无法写入所选位置");
                    stream.write(bytes); stream.flush();
                }
                call.resolve(new JSObject().put("cancelled", false));
            } catch (Exception error) {
                call.reject("保存失败，请检查空间和权限；所选位置可能有未完成文件", error);
            } finally { pendingBytes = null; saving = false; }
        }, "attachment-save").start();
    }
}
