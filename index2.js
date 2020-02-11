import Map from 'ol/Map.js';
import View from 'ol/View.js';
import {getWidth, getCenter} from 'ol/extent.js';
import WMTSCapabilities from 'ol/format/WMTSCapabilities.js';
import TileLayer from 'ol/layer/Tile.js';
import {get as getProjection} from 'ol/proj.js';
import {register} from 'ol/proj/proj4.js';
import {OSM, TileImage, TileWMS, XYZ} from 'ol/source.js';
import WMTS, {optionsFromCapabilities} from 'ol/source/WMTS.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import proj4 from 'proj4';
import {register as registerProj} from 'ol/proj/proj4';

proj4.defs("EPSG:4326","+proj=longlat +datum=WGS84 +no_defs");
proj4.defs("EPSG:2056","+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs");
proj4.defs("EPSG:3857","+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs");
proj4.defs("EPSG:21781","+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.4,15.1,405.3,0,0,0,0 +units=m +no_defs");
registerProj(proj4);

 // adapted from https://github.com/openlayers/ol3/blob/c9e2b384e7f3214847c38e6967e1ba2540eeae27/src/ol/tileurlfunction.js#L134
 var expandUrl = function(url) {
    var urls = [];
    var match = /\{(\d{1,2})-(\d{1,2})\}/.exec(url);
    if (match) {
 
      var startCharCode = parseInt(match[1]);
      var stopCharCode = parseInt(match[2]);
      var charCode;
      for (charCode = startCharCode; charCode <= stopCharCode; ++charCode) {
        urls.push(url.replace(match[0], charCode));
      }
    } else {
      urls.push(url);
    }
    return urls;
  };
 
  var hosts = expandUrl('https://wmts{10-14}.geo.admin.ch');
 
  // config
  var swisstlm3d;
  var epsg_code = '4326';
  var layerid = 'ch.swisstopo.swisstlm3d-karte-farbe';
 
  var layerid = 'ch.swisstopo.pixelkarte-farbe';
 
  var capabilities_url = 'https://wmts10.geo.admin.ch/EPSG/' + epsg_code + '/1.0.0/WMTSCapabilities.xml';
 
  var parser = new WMTSCapabilities();
 
  var extent = [2420000, 130000, 2900000, 1350000];
  var projection = getProjection('EPSG:2056');
  projection.setExtent(extent);
 
  fetch(capabilities_url).then(function(response) {
    return response.text();
  }).then(function(text) {
    var result = parser.read(text);
    var layers = {
      "layers": result.Contents.Layer
    };
 
    // Display layer name + abstract
    for (var i = 0, max = layers.layers.length; i < max; i++) {
      var layer = layers.layers[i];
      console.log(layer.Identifier, layer.TileMatrixSetLink[0]);
    }
 
    var options = optionsFromCapabilities(result, {
      layer: layerid,
      matrixSet: epsg_code + "_26",
      requestEncoding: 'REST'
    });
    console.log(JSON.stringify(options));
    //options.requestEncoding = "REST";
 
    for (var i = 0, m = hosts.length; i < m; i++) {
 
      var host = hosts[i];
 
      options.urls.push(host + "/1.0.0/" + layerid + "/default/{Time}/" + epsg_code + "/{TileMatrix}/{TileCol}/{TileRow}.jpeg")
    };
 console.log(options);
    var source = new WMTS(options);
 
    swisstlm3d = new TileLayer({
      source: source
    });
  
    var map = new Map({
      /*  controls: ol.control.defaults().extend([
          new ol.control.ScaleLine({
            units: 'meters'
          })
        ]),*/
      layers: [swisstlm3d],
      target: 'map',
      view: new View({
        projection: projection, //'EPSG:' + epsg_code,
        center: [2801801.50, 1133424.88],
        projection: projection,
        resolution: 2
      })
    });
 
  })