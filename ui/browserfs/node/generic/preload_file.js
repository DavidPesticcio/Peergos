"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var file = require('../core/file');
var api_error_1 = require('../core/api_error');
var fs = require('../core/node_fs');
var PreloadFile = (function (_super) {
    __extends(PreloadFile, _super);
    function PreloadFile(_fs, _path, _flag, _stat, contents) {
        _super.call(this);
        this._pos = 0;
        this._dirty = false;
        this._fs = _fs;
        this._path = _path;
        this._flag = _flag;
        this._stat = _stat;
        if (contents != null) {
            this._buffer = contents;
        }
        else {
            this._buffer = new Buffer(0);
        }
        if (this._stat.size !== this._buffer.length && this._flag.isReadable()) {
            throw new Error("Invalid buffer: Buffer is " + this._buffer.length + " long, yet Stats object specifies that file is " + this._stat.size + " long.");
        }
    }
    PreloadFile.prototype.isDirty = function () {
        return this._dirty;
    };
    PreloadFile.prototype.resetDirty = function () {
        this._dirty = false;
    };
    PreloadFile.prototype.getBuffer = function () {
        return this._buffer;
    };
    PreloadFile.prototype.getStats = function () {
        return this._stat;
    };
    PreloadFile.prototype.getFlag = function () {
        return this._flag;
    };
    PreloadFile.prototype.getPath = function () {
        return this._path;
    };
    PreloadFile.prototype.getPos = function () {
        if (this._flag.isAppendable()) {
            return this._stat.size;
        }
        return this._pos;
    };
    PreloadFile.prototype.advancePos = function (delta) {
        return this._pos += delta;
    };
    PreloadFile.prototype.setPos = function (newPos) {
        return this._pos = newPos;
    };
    PreloadFile.prototype.sync = function (cb) {
        try {
            this.syncSync();
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    PreloadFile.prototype.syncSync = function () {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    PreloadFile.prototype.close = function (cb) {
        try {
            this.closeSync();
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    PreloadFile.prototype.closeSync = function () {
        throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
    };
    PreloadFile.prototype.stat = function (cb) {
        try {
            cb(null, this._stat.clone());
        }
        catch (e) {
            cb(e);
        }
    };
    PreloadFile.prototype.statSync = function () {
        return this._stat.clone();
    };
    PreloadFile.prototype.truncate = function (len, cb) {
        try {
            this.truncateSync(len);
            if (this._flag.isSynchronous() && !fs.getRootFS().supportsSynch()) {
                this.sync(cb);
            }
            cb();
        }
        catch (e) {
            return cb(e);
        }
    };
    PreloadFile.prototype.truncateSync = function (len) {
        this._dirty = true;
        if (!this._flag.isWriteable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EPERM, 'File not opened with a writeable mode.');
        }
        this._stat.mtime = new Date();
        if (len > this._buffer.length) {
            var buf = new Buffer(len - this._buffer.length);
            buf.fill(0);
            this.writeSync(buf, 0, buf.length, this._buffer.length);
            if (this._flag.isSynchronous() && fs.getRootFS().supportsSynch()) {
                this.syncSync();
            }
            return;
        }
        this._stat.size = len;
        var newBuff = new Buffer(len);
        this._buffer.copy(newBuff, 0, 0, len);
        this._buffer = newBuff;
        if (this._flag.isSynchronous() && fs.getRootFS().supportsSynch()) {
            this.syncSync();
        }
    };
    PreloadFile.prototype.write = function (buffer, offset, length, position, cb) {
        try {
            cb(null, this.writeSync(buffer, offset, length, position), buffer);
        }
        catch (e) {
            cb(e);
        }
    };
    PreloadFile.prototype.writeSync = function (buffer, offset, length, position) {
        this._dirty = true;
        if (position == null) {
            position = this.getPos();
        }
        if (!this._flag.isWriteable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EPERM, 'File not opened with a writeable mode.');
        }
        var endFp = position + length;
        if (endFp > this._stat.size) {
            this._stat.size = endFp;
            if (endFp > this._buffer.length) {
                var newBuff = new Buffer(endFp);
                this._buffer.copy(newBuff);
                this._buffer = newBuff;
            }
        }
        var len = buffer.copy(this._buffer, position, offset, offset + length);
        this._stat.mtime = new Date();
        if (this._flag.isSynchronous()) {
            this.syncSync();
            return len;
        }
        this.setPos(position + len);
        return len;
    };
    PreloadFile.prototype.read = function (buffer, offset, length, position, cb) {
        try {
            cb(null, this.readSync(buffer, offset, length, position), buffer);
        }
        catch (e) {
            cb(e);
        }
    };
    PreloadFile.prototype.readSync = function (buffer, offset, length, position) {
        if (!this._flag.isReadable()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.EPERM, 'File not opened with a readable mode.');
        }
        if (position == null) {
            position = this.getPos();
        }
        var endRead = position + length;
        if (endRead > this._stat.size) {
            length = this._stat.size - position;
        }
        var rv = this._buffer.copy(buffer, offset, position, position + length);
        this._stat.atime = new Date();
        this._pos = position + length;
        return rv;
    };
    PreloadFile.prototype.chmod = function (mode, cb) {
        try {
            this.chmodSync(mode);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    PreloadFile.prototype.chmodSync = function (mode) {
        if (!this._fs.supportsProps()) {
            throw new api_error_1.ApiError(api_error_1.ErrorCode.ENOTSUP);
        }
        this._dirty = true;
        this._stat.chmod(mode);
        this.syncSync();
    };
    return PreloadFile;
}(file.BaseFile));
exports.PreloadFile = PreloadFile;
var NoSyncFile = (function (_super) {
    __extends(NoSyncFile, _super);
    function NoSyncFile(_fs, _path, _flag, _stat, contents) {
        _super.call(this, _fs, _path, _flag, _stat, contents);
    }
    NoSyncFile.prototype.sync = function (cb) {
        cb();
    };
    NoSyncFile.prototype.syncSync = function () { };
    NoSyncFile.prototype.close = function (cb) {
        cb();
    };
    NoSyncFile.prototype.closeSync = function () { };
    return NoSyncFile;
}(PreloadFile));
exports.NoSyncFile = NoSyncFile;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlbG9hZF9maWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2dlbmVyaWMvcHJlbG9hZF9maWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLElBQU8sSUFBSSxXQUFXLGNBQWMsQ0FBQyxDQUFDO0FBSXRDLDBCQUFrQyxtQkFBbUIsQ0FBQyxDQUFBO0FBQ3RELElBQU8sRUFBRSxXQUFXLGlCQUFpQixDQUFDLENBQUM7QUFXdkM7SUFBbUUsK0JBQWE7SUFzQjlFLHFCQUFZLEdBQU0sRUFBRSxLQUFhLEVBQUUsS0FBZSxFQUFFLEtBQVksRUFBRSxRQUFxQjtRQUNyRixpQkFBTyxDQUFDO1FBdEJGLFNBQUksR0FBVyxDQUFDLENBQUM7UUFNakIsV0FBTSxHQUFZLEtBQUssQ0FBQztRQWlCOUIsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7UUFDZixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixFQUFFLENBQUMsQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNyQixJQUFJLENBQUMsT0FBTyxHQUFHLFFBQVEsQ0FBQztRQUMxQixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFFTixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9CLENBQUM7UUFLRCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN2RSxNQUFNLElBQUksS0FBSyxDQUFDLDRCQUE0QixHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxH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S00seUJBQUksR0FBWCxVQUFZLEVBQTBCO1FBQ3BDLEVBQUUsRUFBRSxDQUFDO0lBQ1AsQ0FBQztJQUlNLDZCQUFRLEdBQWYsY0FBeUIsQ0FBQztJQUtuQiwwQkFBSyxHQUFaLFVBQWEsRUFBMEI7UUFDckMsRUFBRSxFQUFFLENBQUM7SUFDUCxDQUFDO0lBSU0sOEJBQVMsR0FBaEIsY0FBMEIsQ0FBQztJQUM3QixpQkFBQztBQUFELENBQUMsQUExQkQsQ0FBa0UsV0FBVyxHQTBCNUU7QUExQlksa0JBQVUsYUEwQnRCLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZmlsZSA9IHJlcXVpcmUoJy4uL2NvcmUvZmlsZScpO1xyXG5pbXBvcnQgZmlsZV9zeXN0ZW0gPSByZXF1aXJlKCcuLi9jb3JlL2ZpbGVfc3lzdGVtJyk7XHJcbmltcG9ydCBTdGF0cyBmcm9tICcuLi9jb3JlL25vZGVfZnNfc3RhdHMnO1xyXG5pbXBvcnQge0ZpbGVGbGFnfSBmcm9tICcuLi9jb3JlL2ZpbGVfZmxhZyc7XHJcbmltcG9ydCB7QXBpRXJyb3IsIEVycm9yQ29kZX0gZnJvbSAnLi4vY29yZS9hcGlfZXJyb3InO1xyXG5pbXBvcnQgZnMgPSByZXF1aXJlKCcuLi9jb3JlL25vZGVfZnMnKTtcclxuXHJcbi8qKlxyXG4gKiBBbiBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgRmlsZSBpbnRlcmZhY2UgdGhhdCBvcGVyYXRlcyBvbiBhIGZpbGUgdGhhdCBpc1xyXG4gKiBjb21wbGV0ZWx5IGluLW1lbW9yeS4gUHJlbG9hZEZpbGVzIGFyZSBiYWNrZWQgYnkgYSBCdWZmZXIuXHJcbiAqXHJcbiAqIFRoaXMgaXMgYWxzbyBhbiBhYnN0cmFjdCBjbGFzcywgYXMgaXQgbGFja3MgYW4gaW1wbGVtZW50YXRpb24gb2YgJ3N5bmMnIGFuZFxyXG4gKiAnY2xvc2UnLiBFYWNoIGZpbGVzeXN0ZW0gdGhhdCB3aXNoZXMgdG8gdXNlIHRoaXMgZmlsZSByZXByZXNlbnRhdGlvbiBtdXN0XHJcbiAqIGV4dGVuZCB0aGlzIGNsYXNzIGFuZCBpbXBsZW1lbnQgdGhvc2UgdHdvIG1ldGhvZHMuXHJcbiAqIEB0b2RvICdjbG9zZScgbGV2ZXIgdGhhdCBkaXNhYmxlcyBmdW5jdGlvbmFsaXR5IG9uY2UgY2xvc2VkLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFByZWxvYWRGaWxlPFQgZXh0ZW5kcyBmaWxlX3N5c3RlbS5GaWxlU3lzdGVtPiBleHRlbmRzIGZpbGUuQmFzZUZpbGUge1xyXG4gIHByaXZhdGUgX3BvczogbnVtYmVyID0gMDtcclxuICBwcml2YXRlIF9wYXRoOiBzdHJpbmc7XHJcbiAgcHJvdGVjdGVkIF9mczogVDtcclxuICBwcml2YXRlIF9zdGF0OiBTdGF0cztcclxuICBwcml2YXRlIF9mbGFnOiBGaWxlRmxhZztcclxuICBwcml2YXRlIF9idWZmZXI6IE5vZGVCdWZmZXI7XHJcbiAgcHJpdmF0ZSBfZGlydHk6IGJvb2xlYW4gPSBmYWxzZTtcclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgZmlsZSB3aXRoIHRoZSBnaXZlbiBwYXRoIGFuZCwgb3B0aW9uYWxseSwgdGhlIGdpdmVuIGNvbnRlbnRzLiBOb3RlXHJcbiAgICogdGhhdCwgaWYgY29udGVudHMgaXMgc3BlY2lmaWVkLCBpdCB3aWxsIGJlIG11dGF0ZWQgYnkgdGhlIGZpbGUhXHJcbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZVN5c3RlbV0gX2ZzIFRoZSBmaWxlIHN5c3RlbSB0aGF0IGNyZWF0ZWQgdGhlIGZpbGUuXHJcbiAgICogQHBhcmFtIFtTdHJpbmddIF9wYXRoXHJcbiAgICogQHBhcmFtIFtCcm93c2VyRlMuRmlsZU1vZGVdIF9tb2RlIFRoZSBtb2RlIHRoYXQgdGhlIGZpbGUgd2FzIG9wZW5lZCB1c2luZy5cclxuICAgKiAgIERpY3RhdGVzIHBlcm1pc3Npb25zIGFuZCB3aGVyZSB0aGUgZmlsZSBwb2ludGVyIHN0YXJ0cy5cclxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5ub2RlLmZzLlN0YXRzXSBfc3RhdCBUaGUgc3RhdHMgb2JqZWN0IGZvciB0aGUgZ2l2ZW4gZmlsZS5cclxuICAgKiAgIFByZWxvYWRGaWxlIHdpbGwgbXV0YXRlIHRoaXMgb2JqZWN0LiBOb3RlIHRoYXQgdGhpcyBvYmplY3QgbXVzdCBjb250YWluXHJcbiAgICogICB0aGUgYXBwcm9wcmlhdGUgbW9kZSB0aGF0IHRoZSBmaWxlIHdhcyBvcGVuZWQgYXMuXHJcbiAgICogQHBhcmFtIFtCcm93c2VyRlMubm9kZS5CdWZmZXI/XSBjb250ZW50cyBBIGJ1ZmZlciBjb250YWluaW5nIHRoZSBlbnRpcmVcclxuICAgKiAgIGNvbnRlbnRzIG9mIHRoZSBmaWxlLiBQcmVsb2FkRmlsZSB3aWxsIG11dGF0ZSB0aGlzIGJ1ZmZlci4gSWYgbm90XHJcbiAgICogICBzcGVjaWZpZWQsIHdlIGFzc3VtZSBpdCBpcyBhIG5ldyBmaWxlLlxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKF9mczogVCwgX3BhdGg6IHN0cmluZywgX2ZsYWc6IEZpbGVGbGFnLCBfc3RhdDogU3RhdHMsIGNvbnRlbnRzPzogTm9kZUJ1ZmZlcikge1xyXG4gICAgc3VwZXIoKTtcclxuICAgIHRoaXMuX2ZzID0gX2ZzO1xyXG4gICAgdGhpcy5fcGF0aCA9IF9wYXRoO1xyXG4gICAgdGhpcy5fZmxhZyA9IF9mbGFnO1xyXG4gICAgdGhpcy5fc3RhdCA9IF9zdGF0O1xyXG4gICAgaWYgKGNvbnRlbnRzICE9IG51bGwpIHtcclxuICAgICAgdGhpcy5fYnVmZmVyID0gY29udGVudHM7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyBFbXB0eSBidWZmZXIuIEl0J2xsIGV4cGFuZCBvbmNlIHdlIHdyaXRlIHN0dWZmIHRvIGl0LlxyXG4gICAgICB0aGlzLl9idWZmZXIgPSBuZXcgQnVmZmVyKDApO1xyXG4gICAgfVxyXG4gICAgLy8gTm90ZTogVGhpcyBpbnZhcmlhbnQgaXMgKm5vdCogbWFpbnRhaW5lZCBvbmNlIHRoZSBmaWxlIHN0YXJ0cyBnZXR0aW5nXHJcbiAgICAvLyBtb2RpZmllZC5cclxuICAgIC8vIE5vdGU6IE9ubHkgYWN0dWFsbHkgbWF0dGVycyBpZiBmaWxlIGlzIHJlYWRhYmxlLCBhcyB3cml0ZWFibGUgbW9kZXMgbWF5XHJcbiAgICAvLyB0cnVuY2F0ZS9hcHBlbmQgdG8gZmlsZS5cclxuICAgIGlmICh0aGlzLl9zdGF0LnNpemUgIT09IHRoaXMuX2J1ZmZlci5sZW5ndGggJiYgdGhpcy5fZmxhZy5pc1JlYWRhYmxlKCkpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBidWZmZXI6IEJ1ZmZlciBpcyBcIiArIHRoaXMuX2J1ZmZlci5sZW5ndGggKyBcIiBsb25nLCB5ZXQgU3RhdHMgb2JqZWN0IHNwZWNpZmllcyB0aGF0IGZpbGUgaXMgXCIgKyB0aGlzLl9zdGF0LnNpemUgKyBcIiBsb25nLlwiKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByb3RlY3RlZCBpc0RpcnR5KCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuX2RpcnR5O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzZXRzIHRoZSBkaXJ0eSBiaXQuIFNob3VsZCBvbmx5IGJlIGNhbGxlZCBhZnRlciBhIHN5bmMgaGFzIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHkuXHJcbiAgICovXHJcbiAgcHJvdGVjdGVkIHJlc2V0RGlydHkoKSB7XHJcbiAgICB0aGlzLl9kaXJ0eSA9IGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTk9OU1RBTkRBUkQ6IEdldCB0aGUgdW5kZXJseWluZyBidWZmZXIgZm9yIHRoaXMgZmlsZS4gISFETyBOT1QgTVVUQVRFISEgV2lsbCBtZXNzIHVwIGRpcnR5IHRyYWNraW5nLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRCdWZmZXIoKTogTm9kZUJ1ZmZlciB7XHJcbiAgICByZXR1cm4gdGhpcy5fYnVmZmVyO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTk9OU1RBTkRBUkQ6IEdldCB1bmRlcmx5aW5nIHN0YXRzIGZvciB0aGlzIGZpbGUuICEhRE8gTk9UIE1VVEFURSEhXHJcbiAgICovXHJcbiAgcHVibGljIGdldFN0YXRzKCk6IFN0YXRzIHtcclxuICAgIHJldHVybiB0aGlzLl9zdGF0O1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldEZsYWcoKTogRmlsZUZsYWcge1xyXG4gICAgcmV0dXJuIHRoaXMuX2ZsYWc7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIHBhdGggdG8gdGhpcyBmaWxlLlxyXG4gICAqIEByZXR1cm4gW1N0cmluZ10gVGhlIHBhdGggdG8gdGhlIGZpbGUuXHJcbiAgICovXHJcbiAgcHVibGljIGdldFBhdGgoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLl9wYXRoO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBjdXJyZW50IGZpbGUgcG9zaXRpb24uXHJcbiAgICpcclxuICAgKiBXZSBlbXVsYXRlIHRoZSBmb2xsb3dpbmcgYnVnIG1lbnRpb25lZCBpbiB0aGUgTm9kZSBkb2N1bWVudGF0aW9uOlxyXG4gICAqID4gT24gTGludXgsIHBvc2l0aW9uYWwgd3JpdGVzIGRvbid0IHdvcmsgd2hlbiB0aGUgZmlsZSBpcyBvcGVuZWQgaW4gYXBwZW5kXHJcbiAgICogICBtb2RlLiBUaGUga2VybmVsIGlnbm9yZXMgdGhlIHBvc2l0aW9uIGFyZ3VtZW50IGFuZCBhbHdheXMgYXBwZW5kcyB0aGUgZGF0YVxyXG4gICAqICAgdG8gdGhlIGVuZCBvZiB0aGUgZmlsZS5cclxuICAgKiBAcmV0dXJuIFtOdW1iZXJdIFRoZSBjdXJyZW50IGZpbGUgcG9zaXRpb24uXHJcbiAgICovXHJcbiAgcHVibGljIGdldFBvcygpOiBudW1iZXIge1xyXG4gICAgaWYgKHRoaXMuX2ZsYWcuaXNBcHBlbmRhYmxlKCkpIHtcclxuICAgICAgcmV0dXJuIHRoaXMuX3N0YXQuc2l6ZTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLl9wb3M7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZHZhbmNlIHRoZSBjdXJyZW50IGZpbGUgcG9zaXRpb24gYnkgdGhlIGluZGljYXRlZCBudW1iZXIgb2YgcG9zaXRpb25zLlxyXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBkZWx0YVxyXG4gICAqL1xyXG4gIHB1YmxpYyBhZHZhbmNlUG9zKGRlbHRhOiBudW1iZXIpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMuX3BvcyArPSBkZWx0YTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldCB0aGUgZmlsZSBwb3NpdGlvbi5cclxuICAgKiBAcGFyYW0gW051bWJlcl0gbmV3UG9zXHJcbiAgICovXHJcbiAgcHVibGljIHNldFBvcyhuZXdQb3M6IG51bWJlcik6IG51bWJlciB7XHJcbiAgICByZXR1cm4gdGhpcy5fcG9zID0gbmV3UG9zO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogKipDb3JlKio6IEFzeW5jaHJvbm91cyBzeW5jLiBNdXN0IGJlIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzZXMgb2YgdGhpc1xyXG4gICAqIGNsYXNzLlxyXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2JcclxuICAgKi9cclxuICBwdWJsaWMgc3luYyhjYjogKGU/OiBBcGlFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xyXG4gICAgdHJ5IHtcclxuICAgICAgdGhpcy5zeW5jU3luYygpO1xyXG4gICAgICBjYigpO1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICBjYihlKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqICoqQ29yZSoqOiBTeW5jaHJvbm91cyBzeW5jLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBzeW5jU3luYygpOiB2b2lkIHtcclxuICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRU5PVFNVUCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiAqKkNvcmUqKjogQXN5bmNocm9ub3VzIGNsb3NlLiBNdXN0IGJlIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzZXMgb2YgdGhpc1xyXG4gICAqIGNsYXNzLlxyXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2JcclxuICAgKi9cclxuICBwdWJsaWMgY2xvc2UoY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHRoaXMuY2xvc2VTeW5jKCk7XHJcbiAgICAgIGNiKCk7XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIGNiKGUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogKipDb3JlKio6IFN5bmNocm9ub3VzIGNsb3NlLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBjbG9zZVN5bmMoKTogdm9pZCB7XHJcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoRXJyb3JDb2RlLkVOT1RTVVApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQXN5bmNocm9ub3VzIGBzdGF0YC5cclxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgQnJvd3NlckZTLm5vZGUuZnMuU3RhdHMpXSBjYlxyXG4gICAqL1xyXG4gIHB1YmxpYyBzdGF0KGNiOiAoZTogQXBpRXJyb3IsIHN0YXQ/OiBTdGF0cykgPT4gdm9pZCk6IHZvaWQge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY2IobnVsbCwgdGhpcy5fc3RhdC5jbG9uZSgpKTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgY2IoZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTeW5jaHJvbm91cyBgc3RhdGAuXHJcbiAgICovXHJcbiAgcHVibGljIHN0YXRTeW5jKCk6IFN0YXRzIHtcclxuICAgIHJldHVybiB0aGlzLl9zdGF0LmNsb25lKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBc3luY2hyb25vdXMgdHJ1bmNhdGUuXHJcbiAgICogQHBhcmFtIFtOdW1iZXJdIGxlblxyXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2JcclxuICAgKi9cclxuICBwdWJsaWMgdHJ1bmNhdGUobGVuOiBudW1iZXIsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XHJcbiAgICB0cnkge1xyXG4gICAgICB0aGlzLnRydW5jYXRlU3luYyhsZW4pO1xyXG4gICAgICBpZiAodGhpcy5fZmxhZy5pc1N5bmNocm9ub3VzKCkgJiYgIWZzLmdldFJvb3RGUygpLnN1cHBvcnRzU3luY2goKSkge1xyXG4gICAgICAgIHRoaXMuc3luYyhjYik7XHJcbiAgICAgIH1cclxuICAgICAgY2IoKTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgcmV0dXJuIGNiKGUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3luY2hyb25vdXMgdHJ1bmNhdGUuXHJcbiAgICogQHBhcmFtIFtOdW1iZXJdIGxlblxyXG4gICAqL1xyXG4gIHB1YmxpYyB0cnVuY2F0ZVN5bmMobGVuOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcclxuICAgIGlmICghdGhpcy5fZmxhZy5pc1dyaXRlYWJsZSgpKSB7XHJcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRVBFUk0sICdGaWxlIG5vdCBvcGVuZWQgd2l0aCBhIHdyaXRlYWJsZSBtb2RlLicpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5fc3RhdC5tdGltZSA9IG5ldyBEYXRlKCk7XHJcbiAgICBpZiAobGVuID4gdGhpcy5fYnVmZmVyLmxlbmd0aCkge1xyXG4gICAgICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihsZW4gLSB0aGlzLl9idWZmZXIubGVuZ3RoKTtcclxuICAgICAgYnVmLmZpbGwoMCk7XHJcbiAgICAgIC8vIFdyaXRlIHdpbGwgc2V0IEBfc3RhdC5zaXplIGZvciB1cy5cclxuICAgICAgdGhpcy53cml0ZVN5bmMoYnVmLCAwLCBidWYubGVuZ3RoLCB0aGlzLl9idWZmZXIubGVuZ3RoKTtcclxuICAgICAgaWYgKHRoaXMuX2ZsYWcuaXNTeW5jaHJvbm91cygpICYmIGZzLmdldFJvb3RGUygpLnN1cHBvcnRzU3luY2goKSkge1xyXG4gICAgICAgIHRoaXMuc3luY1N5bmMoKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLl9zdGF0LnNpemUgPSBsZW47XHJcbiAgICAvLyBUcnVuY2F0ZSBidWZmZXIgdG8gJ2xlbicuXHJcbiAgICB2YXIgbmV3QnVmZiA9IG5ldyBCdWZmZXIobGVuKTtcclxuICAgIHRoaXMuX2J1ZmZlci5jb3B5KG5ld0J1ZmYsIDAsIDAsIGxlbik7XHJcbiAgICB0aGlzLl9idWZmZXIgPSBuZXdCdWZmO1xyXG4gICAgaWYgKHRoaXMuX2ZsYWcuaXNTeW5jaHJvbm91cygpICYmIGZzLmdldFJvb3RGUygpLnN1cHBvcnRzU3luY2goKSkge1xyXG4gICAgICB0aGlzLnN5bmNTeW5jKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBXcml0ZSBidWZmZXIgdG8gdGhlIGZpbGUuXHJcbiAgICogTm90ZSB0aGF0IGl0IGlzIHVuc2FmZSB0byB1c2UgZnMud3JpdGUgbXVsdGlwbGUgdGltZXMgb24gdGhlIHNhbWUgZmlsZVxyXG4gICAqIHdpdGhvdXQgd2FpdGluZyBmb3IgdGhlIGNhbGxiYWNrLlxyXG4gICAqIEBwYXJhbSBbQnJvd3NlckZTLm5vZGUuQnVmZmVyXSBidWZmZXIgQnVmZmVyIGNvbnRhaW5pbmcgdGhlIGRhdGEgdG8gd3JpdGUgdG9cclxuICAgKiAgdGhlIGZpbGUuXHJcbiAgICogQHBhcmFtIFtOdW1iZXJdIG9mZnNldCBPZmZzZXQgaW4gdGhlIGJ1ZmZlciB0byBzdGFydCByZWFkaW5nIGRhdGEgZnJvbS5cclxuICAgKiBAcGFyYW0gW051bWJlcl0gbGVuZ3RoIFRoZSBhbW91bnQgb2YgYnl0ZXMgdG8gd3JpdGUgdG8gdGhlIGZpbGUuXHJcbiAgICogQHBhcmFtIFtOdW1iZXJdIHBvc2l0aW9uIE9mZnNldCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGZpbGUgd2hlcmUgdGhpc1xyXG4gICAqICAgZGF0YSBzaG91bGQgYmUgd3JpdHRlbi4gSWYgcG9zaXRpb24gaXMgbnVsbCwgdGhlIGRhdGEgd2lsbCBiZSB3cml0dGVuIGF0XHJcbiAgICogICB0aGUgY3VycmVudCBwb3NpdGlvbi5cclxuICAgKiBAcGFyYW0gW0Z1bmN0aW9uKEJyb3dzZXJGUy5BcGlFcnJvciwgTnVtYmVyLCBCcm93c2VyRlMubm9kZS5CdWZmZXIpXVxyXG4gICAqICAgY2IgVGhlIG51bWJlciBzcGVjaWZpZXMgdGhlIG51bWJlciBvZiBieXRlcyB3cml0dGVuIGludG8gdGhlIGZpbGUuXHJcbiAgICovXHJcbiAgcHVibGljIHdyaXRlKGJ1ZmZlcjogTm9kZUJ1ZmZlciwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyLCBjYjogKGU6IEFwaUVycm9yLCBsZW4/OiBudW1iZXIsIGJ1ZmY/OiBOb2RlQnVmZmVyKSA9PiB2b2lkKTogdm9pZCB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjYihudWxsLCB0aGlzLndyaXRlU3luYyhidWZmZXIsIG9mZnNldCwgbGVuZ3RoLCBwb3NpdGlvbiksIGJ1ZmZlcik7XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIGNiKGUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogV3JpdGUgYnVmZmVyIHRvIHRoZSBmaWxlLlxyXG4gICAqIE5vdGUgdGhhdCBpdCBpcyB1bnNhZmUgdG8gdXNlIGZzLndyaXRlU3luYyBtdWx0aXBsZSB0aW1lcyBvbiB0aGUgc2FtZSBmaWxlXHJcbiAgICogd2l0aG91dCB3YWl0aW5nIGZvciB0aGUgY2FsbGJhY2suXHJcbiAgICogQHBhcmFtIFtCcm93c2VyRlMubm9kZS5CdWZmZXJdIGJ1ZmZlciBCdWZmZXIgY29udGFpbmluZyB0aGUgZGF0YSB0byB3cml0ZSB0b1xyXG4gICAqICB0aGUgZmlsZS5cclxuICAgKiBAcGFyYW0gW051bWJlcl0gb2Zmc2V0IE9mZnNldCBpbiB0aGUgYnVmZmVyIHRvIHN0YXJ0IHJlYWRpbmcgZGF0YSBmcm9tLlxyXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBsZW5ndGggVGhlIGFtb3VudCBvZiBieXRlcyB0byB3cml0ZSB0byB0aGUgZmlsZS5cclxuICAgKiBAcGFyYW0gW051bWJlcl0gcG9zaXRpb24gT2Zmc2V0IGZyb20gdGhlIGJlZ2lubmluZyBvZiB0aGUgZmlsZSB3aGVyZSB0aGlzXHJcbiAgICogICBkYXRhIHNob3VsZCBiZSB3cml0dGVuLiBJZiBwb3NpdGlvbiBpcyBudWxsLCB0aGUgZGF0YSB3aWxsIGJlIHdyaXR0ZW4gYXRcclxuICAgKiAgIHRoZSBjdXJyZW50IHBvc2l0aW9uLlxyXG4gICAqIEByZXR1cm4gW051bWJlcl1cclxuICAgKi9cclxuICBwdWJsaWMgd3JpdGVTeW5jKGJ1ZmZlcjogTm9kZUJ1ZmZlciwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyKTogbnVtYmVyIHtcclxuICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcclxuICAgIGlmIChwb3NpdGlvbiA9PSBudWxsKSB7XHJcbiAgICAgIHBvc2l0aW9uID0gdGhpcy5nZXRQb3MoKTtcclxuICAgIH1cclxuICAgIGlmICghdGhpcy5fZmxhZy5pc1dyaXRlYWJsZSgpKSB7XHJcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRVBFUk0sICdGaWxlIG5vdCBvcGVuZWQgd2l0aCBhIHdyaXRlYWJsZSBtb2RlLicpO1xyXG4gICAgfVxyXG4gICAgdmFyIGVuZEZwID0gcG9zaXRpb24gKyBsZW5ndGg7XHJcbiAgICBpZiAoZW5kRnAgPiB0aGlzLl9zdGF0LnNpemUpIHtcclxuICAgICAgdGhpcy5fc3RhdC5zaXplID0gZW5kRnA7XHJcbiAgICAgIGlmIChlbmRGcCA+IHRoaXMuX2J1ZmZlci5sZW5ndGgpIHtcclxuICAgICAgICAvLyBFeHRlbmQgdGhlIGJ1ZmZlciFcclxuICAgICAgICB2YXIgbmV3QnVmZiA9IG5ldyBCdWZmZXIoZW5kRnApO1xyXG4gICAgICAgIHRoaXMuX2J1ZmZlci5jb3B5KG5ld0J1ZmYpO1xyXG4gICAgICAgIHRoaXMuX2J1ZmZlciA9IG5ld0J1ZmY7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHZhciBsZW4gPSBidWZmZXIuY29weSh0aGlzLl9idWZmZXIsIHBvc2l0aW9uLCBvZmZzZXQsIG9mZnNldCArIGxlbmd0aCk7XHJcbiAgICB0aGlzLl9zdGF0Lm10aW1lID0gbmV3IERhdGUoKTtcclxuICAgIGlmICh0aGlzLl9mbGFnLmlzU3luY2hyb25vdXMoKSkge1xyXG4gICAgICB0aGlzLnN5bmNTeW5jKCk7XHJcbiAgICAgIHJldHVybiBsZW47XHJcbiAgICB9XHJcbiAgICB0aGlzLnNldFBvcyhwb3NpdGlvbiArIGxlbik7XHJcbiAgICByZXR1cm4gbGVuO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVhZCBkYXRhIGZyb20gdGhlIGZpbGUuXHJcbiAgICogQHBhcmFtIFtCcm93c2VyRlMubm9kZS5CdWZmZXJdIGJ1ZmZlciBUaGUgYnVmZmVyIHRoYXQgdGhlIGRhdGEgd2lsbCBiZVxyXG4gICAqICAgd3JpdHRlbiB0by5cclxuICAgKiBAcGFyYW0gW051bWJlcl0gb2Zmc2V0IFRoZSBvZmZzZXQgd2l0aGluIHRoZSBidWZmZXIgd2hlcmUgd3JpdGluZyB3aWxsXHJcbiAgICogICBzdGFydC5cclxuICAgKiBAcGFyYW0gW051bWJlcl0gbGVuZ3RoIEFuIGludGVnZXIgc3BlY2lmeWluZyB0aGUgbnVtYmVyIG9mIGJ5dGVzIHRvIHJlYWQuXHJcbiAgICogQHBhcmFtIFtOdW1iZXJdIHBvc2l0aW9uIEFuIGludGVnZXIgc3BlY2lmeWluZyB3aGVyZSB0byBiZWdpbiByZWFkaW5nIGZyb21cclxuICAgKiAgIGluIHRoZSBmaWxlLiBJZiBwb3NpdGlvbiBpcyBudWxsLCBkYXRhIHdpbGwgYmUgcmVhZCBmcm9tIHRoZSBjdXJyZW50IGZpbGVcclxuICAgKiAgIHBvc2l0aW9uLlxyXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yLCBOdW1iZXIsIEJyb3dzZXJGUy5ub2RlLkJ1ZmZlcildIGNiIFRoZVxyXG4gICAqICAgbnVtYmVyIGlzIHRoZSBudW1iZXIgb2YgYnl0ZXMgcmVhZFxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkKGJ1ZmZlcjogTm9kZUJ1ZmZlciwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyLCBwb3NpdGlvbjogbnVtYmVyLCBjYjogKGU6IEFwaUVycm9yLCBsZW4/OiBudW1iZXIsIGJ1ZmY/OiBOb2RlQnVmZmVyKSA9PiB2b2lkKTogdm9pZCB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjYihudWxsLCB0aGlzLnJlYWRTeW5jKGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgsIHBvc2l0aW9uKSwgYnVmZmVyKTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgY2IoZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZWFkIGRhdGEgZnJvbSB0aGUgZmlsZS5cclxuICAgKiBAcGFyYW0gW0Jyb3dzZXJGUy5ub2RlLkJ1ZmZlcl0gYnVmZmVyIFRoZSBidWZmZXIgdGhhdCB0aGUgZGF0YSB3aWxsIGJlXHJcbiAgICogICB3cml0dGVuIHRvLlxyXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBvZmZzZXQgVGhlIG9mZnNldCB3aXRoaW4gdGhlIGJ1ZmZlciB3aGVyZSB3cml0aW5nIHdpbGxcclxuICAgKiAgIHN0YXJ0LlxyXG4gICAqIEBwYXJhbSBbTnVtYmVyXSBsZW5ndGggQW4gaW50ZWdlciBzcGVjaWZ5aW5nIHRoZSBudW1iZXIgb2YgYnl0ZXMgdG8gcmVhZC5cclxuICAgKiBAcGFyYW0gW051bWJlcl0gcG9zaXRpb24gQW4gaW50ZWdlciBzcGVjaWZ5aW5nIHdoZXJlIHRvIGJlZ2luIHJlYWRpbmcgZnJvbVxyXG4gICAqICAgaW4gdGhlIGZpbGUuIElmIHBvc2l0aW9uIGlzIG51bGwsIGRhdGEgd2lsbCBiZSByZWFkIGZyb20gdGhlIGN1cnJlbnQgZmlsZVxyXG4gICAqICAgcG9zaXRpb24uXHJcbiAgICogQHJldHVybiBbTnVtYmVyXVxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkU3luYyhidWZmZXI6IE5vZGVCdWZmZXIsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlciwgcG9zaXRpb246IG51bWJlcik6IG51bWJlciB7XHJcbiAgICBpZiAoIXRoaXMuX2ZsYWcuaXNSZWFkYWJsZSgpKSB7XHJcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihFcnJvckNvZGUuRVBFUk0sICdGaWxlIG5vdCBvcGVuZWQgd2l0aCBhIHJlYWRhYmxlIG1vZGUuJyk7XHJcbiAgICB9XHJcbiAgICBpZiAocG9zaXRpb24gPT0gbnVsbCkge1xyXG4gICAgICBwb3NpdGlvbiA9IHRoaXMuZ2V0UG9zKCk7XHJcbiAgICB9XHJcbiAgICB2YXIgZW5kUmVhZCA9IHBvc2l0aW9uICsgbGVuZ3RoO1xyXG4gICAgaWYgKGVuZFJlYWQgPiB0aGlzLl9zdGF0LnNpemUpIHtcclxuICAgICAgbGVuZ3RoID0gdGhpcy5fc3RhdC5zaXplIC0gcG9zaXRpb247XHJcbiAgICB9XHJcbiAgICB2YXIgcnYgPSB0aGlzLl9idWZmZXIuY29weShidWZmZXIsIG9mZnNldCwgcG9zaXRpb24sIHBvc2l0aW9uICsgbGVuZ3RoKTtcclxuICAgIHRoaXMuX3N0YXQuYXRpbWUgPSBuZXcgRGF0ZSgpO1xyXG4gICAgdGhpcy5fcG9zID0gcG9zaXRpb24gKyBsZW5ndGg7XHJcbiAgICByZXR1cm4gcnY7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBc3luY2hyb25vdXMgYGZjaG1vZGAuXHJcbiAgICogQHBhcmFtIFtOdW1iZXJ8U3RyaW5nXSBtb2RlXHJcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYlxyXG4gICAqL1xyXG4gIHB1YmxpYyBjaG1vZChtb2RlOiBudW1iZXIsIGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XHJcbiAgICB0cnkge1xyXG4gICAgICB0aGlzLmNobW9kU3luYyhtb2RlKTtcclxuICAgICAgY2IoKTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgY2IoZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBc3luY2hyb25vdXMgYGZjaG1vZGAuXHJcbiAgICogQHBhcmFtIFtOdW1iZXJdIG1vZGVcclxuICAgKi9cclxuICBwdWJsaWMgY2htb2RTeW5jKG1vZGU6IG51bWJlcik6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLl9mcy5zdXBwb3J0c1Byb3BzKCkpIHtcclxuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKEVycm9yQ29kZS5FTk9UU1VQKTtcclxuICAgIH1cclxuICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcclxuICAgIHRoaXMuX3N0YXQuY2htb2QobW9kZSk7XHJcbiAgICB0aGlzLnN5bmNTeW5jKCk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogRmlsZSBjbGFzcyBmb3IgdGhlIEluTWVtb3J5IGFuZCBYSFIgZmlsZSBzeXN0ZW1zLlxyXG4gKiBEb2Vzbid0IHN5bmMgdG8gYW55dGhpbmcsIHNvIGl0IHdvcmtzIG5pY2VseSBmb3IgbWVtb3J5LW9ubHkgZmlsZXMuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgTm9TeW5jRmlsZTxUIGV4dGVuZHMgZmlsZV9zeXN0ZW0uRmlsZVN5c3RlbT4gZXh0ZW5kcyBQcmVsb2FkRmlsZTxUPiBpbXBsZW1lbnRzIGZpbGUuRmlsZSB7XHJcbiAgY29uc3RydWN0b3IoX2ZzOiBULCBfcGF0aDogc3RyaW5nLCBfZmxhZzogRmlsZUZsYWcsIF9zdGF0OiBTdGF0cywgY29udGVudHM/OiBOb2RlQnVmZmVyKSB7XHJcbiAgICBzdXBlcihfZnMsIF9wYXRoLCBfZmxhZywgX3N0YXQsIGNvbnRlbnRzKTtcclxuICB9XHJcbiAgLyoqXHJcbiAgICogQXN5bmNocm9ub3VzIHN5bmMuIERvZXNuJ3QgZG8gYW55dGhpbmcsIHNpbXBseSBjYWxscyB0aGUgY2IuXHJcbiAgICogQHBhcmFtIFtGdW5jdGlvbihCcm93c2VyRlMuQXBpRXJyb3IpXSBjYlxyXG4gICAqL1xyXG4gIHB1YmxpYyBzeW5jKGNiOiAoZT86IEFwaUVycm9yKSA9PiB2b2lkKTogdm9pZCB7XHJcbiAgICBjYigpO1xyXG4gIH1cclxuICAvKipcclxuICAgKiBTeW5jaHJvbm91cyBzeW5jLiBEb2Vzbid0IGRvIGFueXRoaW5nLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBzeW5jU3luYygpOiB2b2lkIHt9XHJcbiAgLyoqXHJcbiAgICogQXN5bmNocm9ub3VzIGNsb3NlLiBEb2Vzbid0IGRvIGFueXRoaW5nLCBzaW1wbHkgY2FsbHMgdGhlIGNiLlxyXG4gICAqIEBwYXJhbSBbRnVuY3Rpb24oQnJvd3NlckZTLkFwaUVycm9yKV0gY2JcclxuICAgKi9cclxuICBwdWJsaWMgY2xvc2UoY2I6IChlPzogQXBpRXJyb3IpID0+IHZvaWQpOiB2b2lkIHtcclxuICAgIGNiKCk7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIFN5bmNocm9ub3VzIGNsb3NlLiBEb2Vzbid0IGRvIGFueXRoaW5nLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBjbG9zZVN5bmMoKTogdm9pZCB7fVxyXG59XHJcbiJdfQ==