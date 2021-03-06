const express = require("express");
const router = express.Router();
const {
  resolveQuery,
  constructWhereClause,
  groupBy,
  trimExtension,
} = require("../general.js");

router.post("/artistsForDropdown", async function (req, res, next) {
  console.log("Body", req.body);

  const artistName = req.body.artistName,
    result = await getArtists(artistName),
    artists = result.data?.map((artist) => ({ ...artist })) || [],
    status = result.error || 200,
    resJSON = {
      status: status,
      artists: artists,
    };

  res.send(resJSON);
});

router.post("/audioData", async function (req, res, next) {
  console.log("Body:", req.body);

  const params = {
      artistID: req.body.artistID,
      search: req.body.search,
      limit: req.body.limit,
      offset: req.body.offset,
    },
    audioData = await fetchAudioData(params);

  res.send(audioData);
});

router.post("/audioBlob", async function (req, res, next) {
  const blobID = req.body.blobID,
    audioData = await fetchAudioBlob(blobID);

  res.write(audioData.blob);
  res.end();
});

router.post("/uploadAudio", async function (req, res, next) {
  try {
    if (!req.files) {
      res.status(200).send({
        status: 200,
        message: "No file uploaded.",
      });

      return next();
    } else {
      console.log("Audio:", req.files.audio.name);

      const audio = req.files.audio;
      const name = trimExtension(audio.name);
      var title = name;
      const duration = req.body.duration;

      const separator = " - ";
      const separatorIndex = name.indexOf(separator);

      if (separatorIndex != -1) {
        var artists = name.substr(0, separatorIndex);
        title = name.substr(separatorIndex + separator.length);
      }

      const blobID = (await insertAudioBLob(audio.data)).data.insertId;
      const audioID = (await insertAudioData(blobID, title, duration)).data
        .insertId;
      await insertAudioLanguage(audioID, 1);

      if (artists) {
        const audioArtistSeparator = /, | & | [fF]?eat[.]*? /;
        const artistsArr = artists.split(audioArtistSeparator);

        for (const [index, artist] of artistsArr.entries()) {
          var artistID;
          const getArtistByNameResult = (await getArtistByName(artist)).data[0];
          if (getArtistByNameResult) {
            artistID = getArtistByNameResult.id;
          } else {
            artistID = (await insertArtist(artist)).data.insertId;
          }

          await insertAudioArtist(audioID, artistID, index + 1);
        }
      }

      res.status(200).send({
        status: 200,
        id: audioID,
        name: name,
        message: "File uploaded.",
      });
    }
  } catch (error) {
    console.log("Error:", error);

    res.status(500).send({
      status: error,
      message: "Failed to upload.",
      name: audio.name,
    });
  }
});

router.patch("/editAudio", async function (req, res) {
  console.log("Body:", req.body);

  const audioId = req.body.audioId,
    title = req.body.title,
    artists = req.body.artists;

  await editAudio(audioId, title);
  await deleteAudioArtistRelations(audioId);

  artists.forEach(async (artistID, index) => {
    artistID &&
      (await insertAudioArtistRelations(audioId, artistID, index + 1));
  });

  const audioData = await fetchAudioDataById(audioId);

  res.send(audioData);
});

async function editAudio(audioID, title) {
  const query = `
  UPDATE audio
  SET title = "${title}"
  WHERE id = ${audioID}
  ;`;

  return await resolveQuery(query);
}

async function fetchAudioDataById(audioID) {
  const result = await getAudioMetadataById(audioID);

  var audios = result.data?.map((audio) => ({ ...audio })) || [];
  audios = groupBy(audios, "audio_id");
  audios = Object.values(audios)[0];

  const audiosData = {
    status: result.error || 200,
    audio: audios,
  };

  return audiosData;
}

async function getAudioMetadataById(audioID) {
  const query = `
  SELECT audio_id AS audio_id, blob_id, title, artist.id AS artist_id, artist.name, duration 
  FROM audio
  INNER JOIN audio_artist 
  ON audio.id = audio_artist.audio_id
  INNER JOIN artist 
  ON audio_artist.artist_id = artist.id
  WHERE audio_id = ${audioID}
  ;`;

  return await resolveQuery(query);
}

async function deleteAudioArtistRelations(audioID) {
  const query = `
  DELETE FROM audio_artist
  WHERE audio_id = ${audioID}
  ;`;

  return await resolveQuery(query);
}

async function insertAudioArtistRelations(audioID, artistID, artistPosition) {
  const query = `
  INSERT INTO audio_artist(audio_id, artist_id, artist_position) 
  VALUES(${audioID}, ${artistID}, ${artistPosition})
  ;`;

  return await resolveQuery(query);
}

async function getArtists(artistName) {
  var whereArtist = "";

  if (artistName) {
    artistName = artistName
      .replace("\\", "\\\\\\\\")
      .replace("'", "\\'")
      .replace('"', '\\"')
      .replace("%", "\\%");
    // Need to fix character escaping
    // console.log(artistName);

    whereArtist = `
    WHERE artist.name COLLATE utf8mb4_0900_ai_ci LIKE '%${artistName}%'
    AND deleted = 0
    `;
  }

  const query = `
  SELECT id, name
  FROM artist
  ${whereArtist}
  ORDER BY id DESC
  ;`;

  return await resolveQuery(query);
}

async function fetchAudioData(params) {
  const result = await getAudioMetadata(params);

  const status = result.error || 200;
  var audios = result.data?.map((audio) => ({ ...audio })) || [];
  audios = groupBy(audios, "audio_id");
  audios = Array.from(audios.values());
  audios.forEach((audio) => {
    audio.artists = Object.values(audio.artists);
    audio.artists.sort((a, b) => a.position - b.position);
    audio.genres = Object.values(audio.genres);
  });

  const audiosData = {
    status: status,
    audios: audios,
  };

  return audiosData;
}

async function fetchAudioBlob(blobID) {
  const result = await getAudio(blobID),
    audioData = {
      status: result.error || 200,
      blob: result.data[0].audio,
    };

  return audioData;
}

async function getAudioMetadata({ artistID, search, limit, offset }) {
  var artistIDWhereClause = "",
    searchQuery = "",
    queryWhereClauses = [],
    subqueryWhereClauses = [];

  if (artistID) {
    artistIDWhereClause = `
    artist.id = ${artistID}
    `;

    queryWhereClauses.push(artistIDWhereClause);
    subqueryWhereClauses.push(artistIDWhereClause);
  }

  if (search) {
    searchQuery = `
    (
      audio.title COLLATE utf8mb4_0900_ai_ci LIKE '%${search}%'
      OR artist.name COLLATE utf8mb4_0900_ai_ci LIKE '%${search}%'
    )
    `;

    queryWhereClauses.push(searchQuery);
    subqueryWhereClauses.push(searchQuery);
  }

  const queryWhereClause = constructWhereClause(queryWhereClauses);

  const subquery = `
  audio.id <= 
    (
      SELECT audio.id 
      FROM audio 
      LEFT JOIN audio_artist 
      ON audio.id = audio_artist.audio_id
      LEFT JOIN artist 
      ON audio_artist.artist_id = artist.id
      ${queryWhereClause}
      GROUP BY audio.id
      ORDER BY audio.id DESC
      LIMIT 1 OFFSET ${offset}
    )
  `;

  subqueryWhereClauses.push(subquery);

  const subqueryWhereClause = constructWhereClause(subqueryWhereClauses);

  const query = `
  SELECT audio.id AS audio_id, blob_id, title, artist.id AS artist_id, artist.name, artist_position, duration, 
  genre.id AS genre_id, genre.name AS genre_name
  FROM (
    SELECT audio.id, blob_id, title, duration 
    FROM audio
    LEFT JOIN audio_artist 
    ON audio.id = audio_artist.audio_id
    LEFT JOIN artist 
    ON audio_artist.artist_id = artist.id
    ${subqueryWhereClause}
    GROUP BY audio.id
    ORDER BY audio.id DESC
    LIMIT ${limit}
    )
  audio

  LEFT JOIN audio_artist 
  ON audio.id = audio_artist.audio_id
  LEFT JOIN artist 
  ON audio_artist.artist_id = artist.id
  
  LEFT JOIN audio_genre 
  ON audio.id = audio_genre.audio_id
  LEFT JOIN genre 
  ON audio_genre.genre_id = genre.id
  ;`;

  // console.log(query);

  return await resolveQuery(query);
}

async function getAudio(audioID) {
  const query = `
  SELECT audio
  FROM audio_blob
  WHERE id = ${audioID}
  ;`;

  return await resolveQuery(query);
}

async function insertAudioLanguage(audioID, languageID) {
  const query = `
  INSERT INTO audio_language(audio_id, language_id) 
  VALUES(${audioID}, ${languageID})
  ;`;

  return await resolveQuery(query);
}

async function insertAudioArtist(audioID, artistID, artistPosition) {
  const query = `
  INSERT INTO audio_artist(audio_id, artist_id, artist_position) 
  VALUES(${audioID}, ${artistID}, ${artistPosition})
  ;`;

  return await resolveQuery(query);
}

async function getArtistByName(artist) {
  const query = `
  SELECT id 
  FROM artist 
  WHERE name = "${artist}"
  ;`;

  return await resolveQuery(query);
}

async function insertAudioData(blobID, title, duration) {
  const query = `
  INSERT INTO audio(blob_id, title, duration) 
  VALUES("${blobID}", "${title}", "${duration}")
  ;`;

  return await resolveQuery(query);
}

async function insertAudioBLob(audio) {
  const query = `
  INSERT INTO audio_blob SET ?
  `,
    values = {
      audio: audio,
    };

  return await resolveQuery(query, values);
}

async function getNumOfRows() {
  const query = `
  SELECT COUNT(*) 
  FROM audio
  ;`;

  await resolveQuery(query);
}

async function setTag(artistID) {
  const query = `
  CALL INSERT_AUDIO_TAG_RELATIONS(${artistID});
  `;

  return await resolveQuery(query);
}

router.post("/setTag", async function (req, res, next) {
  console.log("Body:", req.body);

  const artistID = req.body.artistID,
    result = await setTag(artistID),
    audiosData = {
      status: result.error || 200,
      audios: result.data,
    };

  res.send(audiosData);
});

module.exports = router;
