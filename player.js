class AnnilPlaylistItem {
  constructor({ name, artist, server, token, catalog, track, duration = 300 }) {
    // Music title
    this.name = name;
    // Artist
    this.artist = artist;
    // Annil server
    this.server = server;
    // Annil server token
    this.token = token;
    // Album catalog
    this.catalog = catalog;
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
          `${this.server}/${this.catalog}/${this.track}?auth=${this.token}`,
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
    return `${this.server}/${this.catalog}/cover?auth=${this.token}`;
  }

  // APlayer tries to set this property, ignore it
  set cover(_) {}
}

class AnnilPlaylist {
  static parse(input) {
    if (typeof input === "string") {
      input = JSON.parse(input);
    }

    if (input.discs) {
      // type: album
      // https://anni.mmf.moe/06.anniv/export-format/02.album.html
      return input.discs
        .map((disc) => {
          return disc.tracks.map(
            (track, i) =>
              new AnnilPlaylistItem({
                name: track.title,
                artist: track.artist || disc.artist || input.artist,
                catalog: disc.catalog || input.catalog,
                track: i + 1,

                server: input.server,
                token: input.token,
              })
          );
        })
        .flat();
    } else if (input.songs) {
      // type: playlist
      // TODO
      return [];
    } else {
      // type: song
      // https://anni.mmf.moe/06.anniv/export-format/01.song.html
      return [
        new AnnilPlaylistItem({
          name: input.title,
          artist: input.artist,
          catalog: input.catalog,
          track: input.track,

          server: input.server,
          token: input.token,
        }),
      ];
    }
  }
}
