package peergos.shared.storage.controller;

import peergos.shared.io.ipfs.api.*;
import peergos.shared.user.*;
import peergos.shared.util.*;

import java.util.*;
import java.util.concurrent.*;

public interface StorageController {

    CompletableFuture<VersionInfo> getVersionInfo();

    class VersionInfo {
        public final Version version;

        public VersionInfo(Version version) {
            this.version = version;
        }

        public Object toJSON() {
            Map<String, Object> res = new TreeMap<>();
            res.put("Version", version.toString());
            return res;
        }

        public static VersionInfo fromJSON(Object json) {
            if (! (json instanceof Map))
                throw new IllegalStateException("Invalid json for VersionInfo");
            return new VersionInfo(Version.parse((String)((Map) json).get("Version")));
        }
    }

    class HTTP implements StorageController {

        private final HttpPoster poster;
        private static final String apiPrefix = "api/v0/";
        public static final String VERSION = "version";

        public HTTP(HttpPoster poster) {
            this.poster = poster;
        }

        @Override
        public CompletableFuture<VersionInfo> getVersionInfo() {
            return poster.get(apiPrefix + VERSION)
                    .thenApply(raw -> VersionInfo.fromJSON(JSONParser.parse(new String(raw))));
        }
    }
}