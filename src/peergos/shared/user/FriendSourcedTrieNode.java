package peergos.shared.user;

import peergos.shared.*;
import peergos.shared.crypto.hash.*;
import peergos.shared.user.fs.*;

import java.util.*;
import java.util.concurrent.*;
import java.util.function.*;

public class FriendSourcedTrieNode implements TrieNode {

    public final String ownerName;
    private final FileWrapper cacheDir;
    private final EntryPoint sharedDir;
    private final Crypto crypto;
    private TrieNode root;
    private long byteOffsetReadOnly;
    private long byteOffsetWrite;

    public FriendSourcedTrieNode(FileWrapper cacheDir,
                                 String ownerName,
                                 EntryPoint sharedDir,
                                 TrieNode root,
                                 long byteOffsetReadOnly,
                                 long byteOffsetWrite,
                                 Crypto crypto) {
        this.cacheDir = cacheDir;
        this.ownerName = ownerName;
        this.sharedDir = sharedDir;
        this.root = root;
        this.byteOffsetReadOnly = byteOffsetReadOnly;
        this.byteOffsetWrite = byteOffsetWrite;
        this.crypto = crypto;
    }

    public static CompletableFuture<Optional<FriendSourcedTrieNode>> build(FileWrapper cacheDir,
                                                                           EntryPoint e,
                                                                           NetworkAccess network,
                                                                           Crypto crypto) {
        return CapabilityStore.loadCachedReadOnlyLinks(cacheDir, e.ownerName, network, crypto)
                .thenCompose(readCaps -> {
                    return CapabilityStore.loadCachedWriteableLinks(cacheDir, e.ownerName, network, crypto)
                            .thenApply(writeCaps -> {
                                List<CapabilityWithPath> allCaps = new ArrayList<>();
                                allCaps.addAll(readCaps.getRetrievedCapabilities());
                                allCaps.addAll(writeCaps.getRetrievedCapabilities());
                                return Optional.of(new FriendSourcedTrieNode(cacheDir,
                                        e.ownerName,
                                        e,
                                        allCaps.stream()
                                                .reduce(TrieNodeImpl.empty(),
                                                        (root, cap) -> root.put(trimOwner(cap.path), new EntryPoint(cap.cap, e.ownerName)),
                                                        (a, b) -> a),
                                        readCaps.getBytesRead(), writeCaps.getBytesRead(), crypto));
                            });
                });
    }

    public static CompletableFuture<Optional<FriendSourcedTrieNode>> buildAndUpdate(FileWrapper cacheDir,
                                                                                    EntryPoint e,
                                                                                    NetworkAccess network,
                                                                                    Crypto crypto) {
        return network.retrieveEntryPoint(e)
                .thenCompose(sharedDirOpt -> {
                    if (!sharedDirOpt.isPresent())
                        return CompletableFuture.completedFuture(Optional.empty());
                    return CapabilityStore.loadReadOnlyLinks(cacheDir, sharedDirOpt.get(), e.ownerName,
                            network, crypto, true, true)
                            .thenCompose(readCaps -> {
                                return CapabilityStore.loadWriteableLinks(cacheDir, sharedDirOpt.get(), e.ownerName,
                                        network, crypto, true, true)
                                        .thenApply(writeCaps -> {
                                            List<CapabilityWithPath> allCaps = new ArrayList<>();
                                            allCaps.addAll(readCaps.getRetrievedCapabilities());
                                            allCaps.addAll(writeCaps.getRetrievedCapabilities());
                                            return Optional.of(new FriendSourcedTrieNode(cacheDir,
                                                    e.ownerName,
                                                    e,
                                                    allCaps.stream()
                                                            .reduce(TrieNodeImpl.empty(),
                                                                    (root, cap) -> root.put(trimOwner(cap.path), new EntryPoint(cap.cap, e.ownerName)),
                                                                    (a, b) -> a),
                                                    readCaps.getBytesRead(), writeCaps.getBytesRead(), crypto));
                                        });
                            });
                });
    }

    private synchronized CompletableFuture<Boolean> ensureUptodate(Crypto crypto, NetworkAccess network) {
        // check there are no new capabilities in the friend's shared directory
        return NetworkAccess.getLatestEntryPoint(sharedDir, network)
                .thenCompose(sharedDir -> {
                    return CapabilityStore.getReadOnlyCapabilityFileSize(sharedDir.file, crypto, network)
                            .thenCompose(bytes -> {
                                if (bytes == byteOffsetReadOnly) {
                                    return addEditableCapabilities(Optional.of(sharedDir.file), crypto, network);
                                } else {
                                    return CapabilityStore.loadReadAccessSharingLinksFromIndex(cacheDir, sharedDir.file,
                                            ownerName, network, crypto, byteOffsetReadOnly, true, true)
                                            .thenCompose(newReadCaps -> {
                                                byteOffsetReadOnly += newReadCaps.getBytesRead();
                                                root = newReadCaps.getRetrievedCapabilities().stream()
                                                        .reduce(root,
                                                                (root, cap) -> root.put(trimOwner(cap.path), new EntryPoint(cap.cap, ownerName)),
                                                                (a, b) -> a);
                                                return addEditableCapabilities(Optional.of(sharedDir.file), crypto, network);
                                            });
                                }
                            });
                });
    }

    private synchronized CompletableFuture<Boolean> addEditableCapabilities(Optional<FileWrapper> sharedDirOpt,
                                                                            Crypto crypto,
                                                                            NetworkAccess network) {
        return CapabilityStore.getEditableCapabilityFileSize(sharedDirOpt.get(), crypto, network)
                .thenCompose(editFilesize -> {
                    if (editFilesize == byteOffsetWrite)
                        return CompletableFuture.completedFuture(true);
                    return CapabilityStore.loadWriteAccessSharingLinksFromIndex(cacheDir, sharedDirOpt.get(),
                            ownerName, network, crypto, byteOffsetWrite, true, true)
                            .thenApply(newWriteCaps -> {
                                byteOffsetWrite += newWriteCaps.getBytesRead();
                                root = newWriteCaps.getRetrievedCapabilities().stream()
                                        .reduce(root,
                                                (root, cap) -> root.put(trimOwner(cap.path), new EntryPoint(cap.cap, ownerName)),
                                                (a, b) -> a);
                                return true;
                            });
                });
    }

    private CompletableFuture<Optional<FileWrapper>> getFriendRoot(NetworkAccess network) {
        return NetworkAccess.getLatestEntryPoint(sharedDir, network)
                .thenCompose(sharedDir -> {
                    return sharedDir.file.retrieveParent(network)
                            .thenCompose(sharedOpt -> {
                                if (! sharedOpt.isPresent()) {
                                    CompletableFuture<Optional<FileWrapper>> empty = CompletableFuture.completedFuture(Optional.empty());
                                    return empty;
                                }
                                return sharedOpt.get().retrieveParent(network);
                            });
                }).exceptionally(t -> {
                    System.out.println("Couldn't retrieve entry point for friend: " + sharedDir.ownerName + ". Did they remove you as a follower?");
                    return Optional.empty();
                });
    }

    private static String trimOwner(String path) {
        path = TrieNode.canonicalise(path);
        return path.substring(path.indexOf("/") + 1);
    }

    @Override
    public synchronized CompletableFuture<Optional<FileWrapper>> getByPath(String path, Hasher hasher, NetworkAccess network) {
        FileProperties.ensureValidPath(path);
        if (path.isEmpty() || path.equals("/"))
            return getFriendRoot(network)
                    .thenApply(opt -> opt.map(f -> f.withTrieNode(this)));
        return ensureUptodate(crypto, network).thenCompose(x -> root.getByPath(path, hasher, network));
    }

    @Override
    public synchronized CompletableFuture<Optional<FileWrapper>> getByPath(String path, Snapshot version, Hasher hasher, NetworkAccess network) {
        FileProperties.ensureValidPath(path);
        if (path.isEmpty() || path.equals("/"))
            return getFriendRoot(network)
                    .thenApply(opt -> opt.map(f -> f.withTrieNode(this)));
        return ensureUptodate(crypto, network).thenCompose(x -> root.getByPath(path, version, hasher, network));
    }

    @Override
    public synchronized CompletableFuture<Set<FileWrapper>> getChildren(String path, Hasher hasher, NetworkAccess network) {
        FileProperties.ensureValidPath(path);
        return ensureUptodate(crypto, network)
                .thenCompose(x -> root.getChildren(path, hasher, network));
    }

    @Override
    public synchronized CompletableFuture<Set<FileWrapper>> getChildren(String path, Hasher hasher, Snapshot version, NetworkAccess network) {
        FileProperties.ensureValidPath(path);
        return root.getChildren(path, hasher, version, network);
    }

    @Override
    public synchronized Set<String> getChildNames() {
        return root.getChildNames();
    }

    @Override
    public synchronized TrieNode put(String path, EntryPoint e) {
        FileProperties.ensureValidPath(path);
        root = root.put(path, e);
        return this;
    }

    @Override
    public synchronized TrieNode putNode(String path, TrieNode t) {
        FileProperties.ensureValidPath(path);
        root = root.putNode(path, t);
        return this;
    }

    @Override
    public synchronized TrieNode removeEntry(String path) {
        root = root.removeEntry(path);
        return this;
    }

    @Override
    public boolean isEmpty() {
        return root.isEmpty();
    }
}
