import { artistsConfigurator } from "../../artists/loadArtists.js";
import { editArtistWindow } from "../../artists/loadArtists.js";
import { lushURL } from "../../partials/loadContent.js";

export default class ArtistSearchBar {
  constructor(searchBarContainer) {
    this.searchBarContainer = searchBarContainer;
    this.searchBar = searchBarContainer.querySelector("#search-bar");
    this.searchButton = searchBarContainer.querySelector("#search-artist");
    this.addButton = searchBarContainer.querySelector("#add-artist");

    this.artists = document.getElementById("artists-ol");
    this.alphaNumericKeyCodes = /^[a-z0-9]+$/i;

    this.addSearchAction();
    this.insertSearchQuery();
    this.addAddAction();
    this.displaySearchBar();
  }

  addSearchAction() {
    this.searchButton.addEventListener("click", this.sendSearchRequest);

    this.searchBar.addEventListener("focus", () =>
      window.addEventListener("keyup", this.sendSearchRequest)
    );

    this.searchBar.addEventListener("blur", () =>
      window.removeEventListener("keyup", this.sendSearchRequest)
    );
  }

  insertSearchQuery() {
    this.searchBar.value = lushURL.get("search");
  }

  sendSearchRequest = (event) => {
    // console.log(event.key);
    // console.log(this.alphaNumericKeyCodes);
    // if (this.alphaNumericKeyCodes.test(event.key)) {

    lushURL.insertURLParam("search", this.searchBar.value);

    this.artists.textContent = "";

    artistsConfigurator.atTheBottom = true;
    artistsConfigurator.reqArtistDataSpec.search = this.searchBar.value;
    artistsConfigurator.reqArtistDataSpec.offset = 0;
    artistsConfigurator.getArtists();
    // }
  };

  addAddAction() {
    this.addButton.onclick = () => {
      editArtistWindow.open();
    };
  }

  displaySearchBar() {
    document
      .getElementById("search-bar-container")
      .replaceWith(this.searchBarContainer);
  }
}
