import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.awt.Desktop;
import java.awt.Toolkit;
import java.awt.datatransfer.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.Executors;

/** Local-only bridge: serves the PDF tool and publishes real Windows file clipboard data. */
public final class PdfMergerClipboard {
    private static final long MAX_BYTES = 512L * 1024 * 1024;
    private final Path root, helper;
    private final String token, origin, base;
    private final HttpServer server;

    private PdfMergerClipboard(Path root) throws Exception {
        this.root = root.toRealPath();
        helper = this.root.resolve("PDF_MERGER/java-helper");
        byte[] secret = new byte[24];
        new SecureRandom().nextBytes(secret);
        token = HexFormat.of().formatHex(secret);
        server = HttpServer.create(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), 0), 0);
        origin = "http://127.0.0.1:" + server.getAddress().getPort();
        base = "/" + token + "/";
        server.createContext("/", this::handle);
        server.setExecutor(Executors.newFixedThreadPool(3));
    }

    private void reply(HttpExchange request, int status, String message) throws IOException {
        reply(request, status, message.getBytes(StandardCharsets.UTF_8), "text/plain; charset=utf-8");
    }

    private void reply(HttpExchange request, int status, byte[] body, String type) throws IOException {
        var headers = request.getResponseHeaders();
        headers.set("Content-Type", type);
        headers.set("Cache-Control", "no-store");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Referrer-Policy", "no-referrer");
        headers.set("Cross-Origin-Resource-Policy", "same-origin");
        headers.set("Content-Security-Policy", "frame-ancestors 'none'");
        request.sendResponseHeaders(status, body.length);
        request.getResponseBody().write(body);
    }

    private void handle(HttpExchange request) throws IOException {
        try {
            String host = request.getRequestHeaders().getFirst("Host");
            if (!origin.substring(7).equals(host)) { reply(request, 403, "Invalid host"); return; }
            String path = request.getRequestURI().getPath();
            if (!path.startsWith(base)) { reply(request, 404, "Not found"); return; }
            String route = path.substring(base.length());
            if ("GET".equals(request.getRequestMethod()) && route.isEmpty()) {
                reply(request, 200, Files.readAllBytes(root.resolve("PDF_MERGER.html")), "text/html; charset=utf-8");
            } else if ("GET".equals(request.getRequestMethod()) && route.equals("health")) {
                reply(request, 200, "PDF_MERGER_JAVA_READY");
            } else if ("POST".equals(request.getRequestMethod()) && route.equals("clipboard")) {
                String source = request.getRequestHeaders().getFirst("Origin");
                if (!origin.equals(source) || !"1".equals(request.getRequestHeaders().getFirst("X-PDF-Merger"))) {
                    reply(request, 403, "Only this local PDF Merger page can copy files"); return;
                }
                if (!"application/pdf".equalsIgnoreCase(request.getRequestHeaders().getFirst("Content-Type"))) {
                    reply(request, 415, "Expected a PDF file"); return;
                }
                copyFile(request);
            } else reply(request, 404, "Not found");
        } catch (IllegalStateException e) {
            reply(request, 503, "Windows Clipboard is busy. Please try again.");
        } catch (Exception e) {
            System.err.println("PDF clipboard helper: " + e.getMessage());
            reply(request, 500, "Unable to copy this file. Please try again.");
        } finally { request.close(); }
    }

    private void copyFile(HttpExchange request) throws Exception {
        String rawQuery = request.getRequestURI().getRawQuery();
        String name = "document.pdf";
        if (rawQuery != null) {
            for (String pair : rawQuery.split("&")) {
                if (pair.startsWith("name=")) name = URLDecoder.decode(pair.substring(5), StandardCharsets.UTF_8);
            }
        }
        name = name.replaceAll("[<>:\"/\\\\|?*\\p{Cntrl}]", "_").replaceAll("[. ]+$", "");
        if (name.isBlank()) name = "document.pdf";
        if (name.length() > 160) name = name.substring(0, 160);
        if (name.matches("(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\\..*)?$")) name = "_" + name;
        if (!name.toLowerCase(Locale.ROOT).endsWith(".pdf")) name += ".pdf";
        String length = request.getRequestHeaders().getFirst("Content-Length");
        if (length != null && Long.parseLong(length) > MAX_BYTES) { reply(request, 413, "File exceeds 512 MB"); return; }
        Path folder = helper.resolve("clipboard-files").resolve(UUID.randomUUID().toString());
        Files.createDirectories(folder);
        Path file = folder.resolve(name);
        boolean published = false;
        try {
            long size = 0;
            try (InputStream input = request.getRequestBody(); OutputStream output = Files.newOutputStream(file, StandardOpenOption.CREATE_NEW)) {
                byte[] buffer = new byte[65536];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    size += count;
                    if (size > MAX_BYTES) { reply(request, 413, "File exceeds 512 MB"); return; }
                    output.write(buffer, 0, count);
                }
            }
            byte[] prefix;
            try (InputStream input = Files.newInputStream(file)) { prefix = input.readNBytes(1024); }
            if (!new String(prefix, StandardCharsets.ISO_8859_1).contains("%PDF-")) { reply(request, 415, "Invalid PDF header"); return; }
            Transferable selection = new FileSelection(List.of(file.toFile()));
            Clipboard clipboard = Toolkit.getDefaultToolkit().getSystemClipboard();
            for (int attempt = 0; ; attempt++) {
                try { clipboard.setContents(selection, null); break; }
                catch (IllegalStateException busy) { if (attempt >= 7) throw busy; Thread.sleep(100); }
            }
            published = true;
            reply(request, 200, "PDF_FILE_COPIED");
        } finally {
            if (!published) { Files.deleteIfExists(file); Files.deleteIfExists(folder); }
        }
    }

    private record FileSelection(List<File> files) implements Transferable {
        public DataFlavor[] getTransferDataFlavors() { return new DataFlavor[]{ DataFlavor.javaFileListFlavor }; }
        public boolean isDataFlavorSupported(DataFlavor flavor) { return DataFlavor.javaFileListFlavor.equals(flavor); }
        public Object getTransferData(DataFlavor flavor) throws UnsupportedFlavorException {
            if (!isDataFlavorSupported(flavor)) throw new UnsupportedFlavorException(flavor);
            return files;
        }
    }

    public static void main(String[] args) throws Exception {
        Path root = args.length > 0 ? Path.of(args[0]) : Path.of(".");
        PdfMergerClipboard app = new PdfMergerClipboard(root);
        app.server.start();
        String url = app.origin + app.base;
        long pid = ProcessHandle.current().pid();
        Files.writeString(app.helper.resolve("session.json"), "{\"pid\":" + pid + ",\"url\":\"" + url + "\"}", StandardCharsets.UTF_8);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> app.server.stop(0)));
        System.out.println("PDF Merger Java helper ready: " + url);
        if (args.length < 2 || !args[1].equals("--no-browser")) {
            if (Desktop.isDesktopSupported()) Desktop.getDesktop().browse(URI.create(url));
        }
    }
}
