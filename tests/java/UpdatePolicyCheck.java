import com.company.departmentsteward.UpdatePolicy;
public class UpdatePolicyCheck {
    interface Attempt { void run() throws Exception; }
    static void denied(Attempt action) throws Exception { try { action.run(); } catch (Exception expected) { return; } throw new AssertionError("Expected rejection"); }
    public static void main(String[] args) throws Exception {
        String hash = "a".repeat(64);
        UpdatePolicy.origin("https://business.example.com");
        UpdatePolicy.origin("http://192.168.0.253:8088");
        denied(() -> UpdatePolicy.origin("http://example.com"));
        denied(() -> UpdatePolicy.origin("https://user:secret@example.com"));
        denied(() -> UpdatePolicy.origin("https://example.com/path"));
        UpdatePolicy.manifest(4,3,"/downloads/test.apk",100,hash);
        denied(() -> UpdatePolicy.manifest(3,3,"/downloads/test.apk",100,hash));
        denied(() -> UpdatePolicy.manifest(4,3,"https://evil.example/test.apk",100,hash));
        denied(() -> UpdatePolicy.manifest(4,3,"/downloads/../test.apk",100,hash));
        denied(() -> UpdatePolicy.manifest(4,3,"/downloads/test.apk",0,hash));
        denied(() -> UpdatePolicy.manifest(4,3,"/downloads/test.apk",101L*1024*1024,hash));
        denied(() -> UpdatePolicy.manifest(4,3,"/downloads/test.apk",100,"wrong"));
        UpdatePolicy.bytes(100,100,hash,hash.toUpperCase());
        denied(() -> UpdatePolicy.bytes(99,100,hash,hash));
        denied(() -> UpdatePolicy.bytes(100,100,hash,"b".repeat(64)));
        System.out.println("PASS: update origin, version, path, size, checksum, truncation validation");
    }
}
