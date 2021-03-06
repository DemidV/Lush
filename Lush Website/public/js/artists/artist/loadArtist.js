import ArtistConfigurator from "./ArtistConfigurator.js";
import loadArtistTemplate from "./loadArtistTemplate.js";

export const loadArtist = async () => {
  await Promise.resolve(loadArtistTemplate()).then(
    (artistLi) => new ArtistConfigurator(artistLi)
  );
};
