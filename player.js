class AnnilPlaylistItem {
  constructor({
    name,
    artist,
    server,
    token,
    album_id,
    disc,
    track,
    duration = 300,
  }) {
    // Music title
    this.name = name;
    // Artist
    this.artist = artist;
    // Annil server
    this.server = server;
    // Annil server token
    this.token = token;
    // Album id
    this.album_id = album_id;
    // Disc id
    this.disc = disc;
    // Track number
    this.track = track;
    // Track duration
    this.duration = duration;
  }

  get url() {
    if (!this._url) {
      const mediaSource = new MediaSource();
      mediaSource.addEventListener("sourceopen", () => {
        URL.revokeObjectURL(this._object_url);
        this._url = undefined;

        fetch(
          `${this.server}/${this.album_id}/${this.disc}/${this.track}?auth=${this.token}`,
          { cache: "force-cache" }
        ).then((resp) => {
          // set source buffer mime type
          const mime = resp.headers.get("Content-Type") || "audio/aac";
          const sourceBuffer = mediaSource.addSourceBuffer(mime);

          // set media source duration
          mediaSource.duration = this.duration;

          // get body as reader
          const reader = resp.body.getReader();
          const appendBuffer = ({ done, value }) => {
            if (!done) {
              // body not finished, append buffer
              sourceBuffer.appendBuffer(value);
            } else {
              mediaSource.endOfStream();
              // update duration after stream ends
              this.duration = mediaSource.duration;
            }
          };

          // read body on source buffer update ends
          sourceBuffer.addEventListener("updateend", () =>
            reader.read().then(appendBuffer)
          );
          // read body once
          reader.read().then(appendBuffer);
        });
      });
      this._url = URL.createObjectURL(mediaSource);
    }

    return this._url;
  }

  get cover() {
    return `${this.server}/${this.album_id}/cover`;
  }

  // APlayer tries to set this property, ignore it
  set cover(_) {}
}

class AnnilPlaylist {
  static parse(input) {
    if (typeof input === "string") {
      input = JSON.parse(input);
    }
    // https://book.anni.rs/06.anniv/07.export-format.html
    return input.songs
      .map((disc) =>
        disc.tracks.map((track) => ({
          album_id: disc.album_id,
          disc_id: disc.disc_id,
          track_id: track,
        }))
      )
      .flat()
      .map((track) => {
        const trackInfo =
          input.metadata[track.album_id].discs[track.disc_id - 1].tracks[
            track.track_id - 1
          ];
        return new AnnilPlaylistItem({
          name: trackInfo.title,
          artist: trackInfo.artist,
          server: input.tokens[0].server,
          token: input.tokens[0].token,
          album_id: track.album_id,
          disc: track.disc_id,
          track: track.track_id,
        });
      });
  }
}
