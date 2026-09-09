package com.company.departmentsteward;

import java.net.URI;
import java.util.Arrays;

/** Pure validation shared by updater and local Java tests. */
public final class UpdatePolicy {
    public static String origin(String input) throws Exception {
        URI uri = new URI(input);
        String host = uri.getHost();
        if (host == null || uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null ||
            !(uri.getPath().isEmpty() || uri.getPath().equals("/"))) throw new Exception("服务地址格式错误");
        boolean local = host.equals("localhost") || host.equals("[::1]");
        String[] parts = host.split("\\.");
        if (parts.length == 4) try {
            int[] ip = Arrays.stream(parts).mapToInt(Integer::parseInt).toArray();
            local = Arrays.stream(ip).allMatch(n -> n >= 0 && n <= 255) &&
                (ip[0] == 10 || ip[0] == 127 || (ip[0] == 192 && ip[1] == 168) || (ip[0] == 172 && ip[1] >= 16 && ip[1] <= 31));
        } catch (NumberFormatException ignored) {}
        if (!"https".equals(uri.getScheme()) && !("http".equals(uri.getScheme()) && local)) throw new Exception("公网更新必须使用 HTTPS");
        return input.replaceAll("/$", "");
    }
    public static void manifest(long version, long installed, String path, long size, String hash) throws Exception {
        if (version <= installed || !path.matches("/downloads/[A-Za-z0-9._-]+\\.apk") || size <= 0 || size > 100L * 1024 * 1024 || !hash.matches("[a-fA-F0-9]{64}"))
            throw new Exception("更新信息无效或版本不高于已安装版本");
    }
    public static void bytes(long actual, long expected, String actualHash, String expectedHash) throws Exception {
        if (actual != expected || !actualHash.equalsIgnoreCase(expectedHash)) throw new Exception("安装包大小或 SHA256 校验失败，未启动安装");
    }
}
