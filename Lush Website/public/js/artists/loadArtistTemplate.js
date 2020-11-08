export default function loadArtistTemplate() {
  const xmlhttp = new XMLHttpRequest();
  var template, artistLi;

  return new Promise((resolve, reject) => {
    xmlhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        template = new DOMParser().parseFromString(
          this.responseText,
          "text/html"
        );
        artistLi = template.getElementsByClassName("artist-list-item")[0];

        resolve(artistLi);
      }
    };

    xmlhttp.open(
      "GET",
      `/public/html/partials/artists/artistTemplate.html`,
      true
    );
    xmlhttp.send();
  });
}
