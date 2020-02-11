import 'ol/ol.css';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import OSM from 'ol/source/OSM';
import WMTS, {optionsFromCapabilities} from 'ol/source/WMTS';
import TileWMS from 'ol/source/TileWMS';
import WMTSCapabilities from 'ol/format/WMTSCapabilities';
import XYZ from 'ol/source/XYZ';
import TileGrid from 'ol/tilegrid/WMTS';
import ImageWMS from 'ol/source/ImageWMS';
import {defaults as defaultControls} from 'ol/control';
import MousePosition from 'ol/control/MousePosition';
import {createStringXY} from 'ol/coordinate';
import {get as getProjection, transformExtent, transform} from 'ol/proj';
import OLCesium from 'olcs/OLCesium';
import proj4, { Proj } from 'proj4';
import {register as registerProj} from 'ol/proj/proj4';
import {fromLonLat} from 'ol/proj';
import {getWidth, getTopLeft} from 'ol/extent';

proj4.defs("EPSG:4326","+proj=longlat +datum=WGS84 +no_defs");
proj4.defs("EPSG:2056","+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs");
proj4.defs("EPSG:3857","+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs");
proj4.defs("EPSG:21781","+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.4,15.1,405.3,0,0,0,0 +units=m +no_defs");
registerProj(proj4);

var Projections = {
  createProj: function(epsg, extent) {
    var _proj;
    _proj = getProjection("EPSG:" + epsg);
    if (undefined !== extent) {
      _proj.setExtent(extent)
    }
    _proj.epsg = epsg;
    return _proj;
  }
}

Projections['ch_lv95'] = Projections.createProj("2056", [2420000, 1030000, 2900000, 1350000]);
Projections['ch_lv03'] = Projections.createProj("21781", transformExtent(Projections['ch_lv95'].getExtent(), "EPSG:2056", "EPSG:21781"));
Projections['google'] = Projections.createProj("3857");
Projections['wgs'] = Projections.createProj("4326");

fetch("./resources/ch_wmts_4326_capabilities.xml").then(function(response) {
  return response.text();
}).then(function(text) {
  //console.log(text);
  /*
  var result = new WMTSCapabilities().read(text);
  var options = optionsFromCapabilities(result, {
    layer: 'ch.swisstopo.pixelkarte-farbe',
    matrixSet: "4326_26",
    requestEncoding: 'REST'
  });
  var source = new WMTS(options);
  var swisstlm3d = new TileLayer({
    source: source
  });
*/

  
  var wmsCadastre = new TileLayer({
    extent: transformExtent(Projections['ch_lv95'].getExtent(), "EPSG:2056", "EPSG:4326"),
    source: new TileWMS({
      url: 'https://wms.geo.admin.ch/?SERVICE=WMS',
      crossOrigin: 'anonymous',

      params: {
        'LAYERS': 'ch.kantone.cadastralwebmap-farbe',
        'FORMAT': 'image/png',
        'TILED': true,
        'VERSION': '1.1.1'
      },
      serverType: 'mapserver'
    })
  });

  var ol2d = new Map({
    layers: [new TileLayer({
      source: new OSM()
    })],
    target: 'map',
    view: new View({
      projection: Projections['wgs'],
      center: transform([2721200, 1258050], "EPSG:2056", "EPSG:4326"),
      zoom: 15
    })
  });


  const ol3d = new OLCesium({map: ol2d, target: "map3d"});
  const scene = ol3d.getCesiumScene();

  scene.terrainProvider = new Cesium.CesiumTerrainProvider({
    url:
      "//3d.geo.admin.ch/1.0.0/ch.swisstopo.terrain.3d/default/20160115/4326/"
  });


  //https://github.com/AnalyticalGraphicsInc/3d-tiles

  var getBuildingsTileset = function() {
    var buildings = new Cesium.Cesium3DTileset({
      url:
        "https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swisstlm3d.3d/20190313/tileset.json"
    });
    buildings.debugColorizeTiles = true;
    return buildings;



  };
  var getVegetationTileset = function() {
    return new Cesium.Cesium3DTileset({
      url: "https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.vegetation.3d/20190313/tileset.json"
    });
  };
  var getNamesTileset = function() {
    return new Cesium.Cesium3DTileset({
      url: "https://vectortiles0.geo.admin.ch/3d-tiles/ch.swisstopo.swissnames3d.3d/20180716/tileset.json"
    });
  };

var provider = new Cesium.WebMapServiceImageryProvider({
    url : 'https://wms.geo.admin.ch/?&SERVICE=WMS',
    //layers : 'ch.kantone.cadastralwebmap-farbe'
    layers : 'ch.are.bauzonen'
});


var handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

// Information about the currently selected feature
var selected = {
  feature: undefined,
  originalColor: new Cesium.Color()
};

// Get default left click handler for when a feature is not picked on left click
var clickHandler = handler.getInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
// If silhouettes are supported, silhouette features in blue on mouse over and silhouette green on mouse click.
// If silhouettes are not supported, change the feature color to yellow on mouse over and green on mouse click.
if (Cesium.PostProcessStageLibrary.isSilhouetteSupported(scene)) {
  // Silhouettes are supported
  var silhouetteBlue = Cesium.PostProcessStageLibrary.createEdgeDetectionStage();
  silhouetteBlue.uniforms.color = Cesium.Color.BLUE;
  silhouetteBlue.uniforms.length = 0.01;
  silhouetteBlue.selected = [];
  var silhouetteGreen = Cesium.PostProcessStageLibrary.createEdgeDetectionStage();
  silhouetteGreen.uniforms.color = Cesium.Color.LIME;
  silhouetteGreen.uniforms.length = 0.01;
  silhouetteGreen.selected = [];
  scene.postProcessStages.add(Cesium.PostProcessStageLibrary.createSilhouetteStage([silhouetteBlue, silhouetteGreen]));
  // Silhouette a feature blue on hover.
  handler.setInputAction(function onMouseMove(movement) {
      // If a feature was previously highlighted, undo the highlight
      silhouetteBlue.selected = [];
      // Pick a new feature
      var pickedFeature = scene.pick(movement.endPosition);
      if (!Cesium.defined(pickedFeature)) {
          return;
      }
      // A feature was picked, so show it's overlay content
      var name = pickedFeature.getProperty('name');
      if (!Cesium.defined(name)) {
          name = pickedFeature.getProperty('id');
      }
      // Highlight the feature if it's not already selected.
      if (pickedFeature !== selected.feature) {
          silhouetteBlue.selected = [pickedFeature];
      }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  // Silhouette a feature on selection and show metadata in the InfoBox.
  handler.setInputAction(function onLeftClick(movement) {
      // If a feature was previously selected, undo the highlight
      silhouetteGreen.selected = [];
      // Pick a new feature
      var pickedFeature = scene.pick(movement.position);
      if (!Cesium.defined(pickedFeature)) {
          clickHandler(movement);
          return;
      }
      console.log(pickedFeature._content.featureLength);
      // Select the feature if it's not already selected
      if (silhouetteGreen.selected[0] === pickedFeature) {
          return;
      }
      // Save the selected feature's original color
      var highlightedFeature = silhouetteBlue.selected[0];
      if (pickedFeature === highlightedFeature) {
          silhouetteBlue.selected = [];
      }
      // Highlight newly selected feature
      silhouetteGreen.selected = [pickedFeature];
      // Set feature infobox description
      var propertyNames = pickedFeature.getPropertyNames();
      var length = propertyNames.length;
      var currentC = Cesium.Color.clone(pickedFeature.color).withAlpha(0.5);
      pickedFeature.color = currentC;
      for (var i = 0; i < length; ++i) {
          var propertyName = propertyNames[i];
          console.log(propertyName + ': ' + pickedFeature.getProperty(propertyName));
      }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
} else {
  // Silhouettes are not supported. Instead, change the feature color.
  // Information about the currently highlighted feature
  var highlighted = {
      feature : undefined,
      originalColor : new Cesium.Color()
  };
  // Color a feature yellow on hover.
  handler.setInputAction(function onMouseMove(movement) {
      // If a feature was previously highlighted, undo the highlight
      if (Cesium.defined(highlighted.feature)) {
          highlighted.feature.color = highlighted.originalColor;
          highlighted.feature = undefined;
      }
      // Pick a new feature
      var pickedFeature = scene.pick(movement.endPosition);
      if (!Cesium.defined(pickedFeature)) {
          return;
      }
      // A feature was picked, so show it's overlay content
      var name = pickedFeature.getProperty('name');
      if (!Cesium.defined(name)) {
          name = pickedFeature.getProperty('id');
      }
      // Highlight the feature if it's not already selected.
      if (pickedFeature !== selected.feature) {
          highlighted.feature = pickedFeature;
          Cesium.Color.clone(pickedFeature.color, highlighted.originalColor);
          pickedFeature.color = Cesium.Color.YELLOW;
      }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  // Color a feature on selection and show metadata in the InfoBox.
  handler.setInputAction(function onLeftClick(movement) {
      // If a feature was previously selected, undo the highlight
      if (Cesium.defined(selected.feature)) {
          selected.feature.color = selected.originalColor;
          selected.feature = undefined;
      }
      // Pick a new feature
      var pickedFeature = scene.pick(movement.position);
      if (!Cesium.defined(pickedFeature)) {
          clickHandler(movement);
          return;
      }
      // Select the feature if it's not already selected
      if (selected.feature === pickedFeature) {
          return;
      }
      selected.feature = pickedFeature;
      // Save the selected feature's original color
      if (pickedFeature === highlighted.feature) {
          Cesium.Color.clone(highlighted.originalColor, selected.originalColor);
          highlighted.feature = undefined;
      } else {
          Cesium.Color.clone(pickedFeature.color, selected.originalColor);
      }
      // Highlight newly selected feature
      pickedFeature.color = Cesium.Color.LIME;
      // Set feature infobox description
      var featureName = pickedFeature.getProperty('name');
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}


/*
var ellipsoid = scene.globe.ellipsoid;
var position = Cesium.Cartesian3.fromDegrees(0.0, 0.0);
var handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
handler.setInputAction(function(movement) {
  //console.log(Cesium.SceneTransforms.wgs84ToWindowCoordinates(scene, position));
  var feature = scene.pick(movement.position);
  if (feature instanceof Cesium.Cesium3DTileFeature) {
      console.log(feature)
      var propertyNames = feature.getPropertyNames();
      var length = propertyNames.length;
      for (var i = 0; i < length; ++i) {
          var propertyName = propertyNames[i];
          console.log(propertyName + ': ' + feature.getProperty(propertyName));
      }
      feature.color.alpha = 0.5;
      
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
*/


scene.globe.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
  // Aerial image
  //url: "//wmts20.geo.admin.ch/1.0.0/ch.swisstopo.swissimage-product/default/current/4326/{z}/{x}/{y}.jpeg",
  // Map
  url:
    //"//wmts10.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-karte-farbe.3d/default/current/4326/{z}/{x}/{y}.jpeg",
    "wmts20.geo.admin.ch/1.0.0/ch.swisstopo.swissimage-product/default/current/4326/{z}/{x}/{y}.jpeg",
  minimumLevel: 8,
  maximumLevel: 17,
  tilingScheme: new Cesium.GeographicTilingScheme({
    numberOfLevelZeroTilesX: 2,
    numberOfLevelZeroTilesY: 1
  }),
  rectangle: Cesium.Rectangle.fromDegrees(
    5.013926957923385,
    45.35600133779394,
    11.477436312994008,
    48.27502358353741
  )
}));

//scene.globe.imageryLayers.addImageryProvider(provider);


  scene.primitives.add(getNamesTileset());


  scene.primitives.add(getBuildingsTileset());
  scene.primitives.add(getVegetationTileset());
  console.log(scene.imageryLayers);

  window.enable3D = function() {
    ol3d.setEnabled(true);
  }



}).catch(function(e) {
  console.log(e);
})

/*
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
*/

return
























// We define some global view variables
var RESOLUTIONS = [
  4000,
  3750,
  3500,
  3250,
  3000,
  2750,
  2500,
  2250,
  2000,
  1750,
  1500,
  1250,
  1000,
  750,
  650,
  500,
  250,
  100,
  50,
  20,
  10,
  5,
  2.5,
  2,
  1.5,
  1,
  0.5,
  0.25,
  0.1
];

proj4.defs("EPSG:4326","+proj=longlat +datum=WGS84 +no_defs");
proj4.defs("EPSG:2056","+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs");
proj4.defs("EPSG:3857","+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs");
proj4.defs("EPSG:21781","+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.4,15.1,405.3,0,0,0,0 +units=m +no_defs");
registerProj(proj4);

var Projections = {
  createProj: function(epsg, extent) {
    var _proj;
    _proj = getProjection("EPSG:" + epsg);
    if (undefined !== extent) {
      _proj.setExtent(extent)
    }
    _proj.epsg = epsg;
    return _proj;
  }
}
console.log(fromLonLat([5.140242, 45.398181]));
console.log(transform(fromLonLat([5.140242, 45.398181]),"EPSG:3857", "EPSG:2056"));
console.log(transform(fromLonLat([11.47757, 48.230651]),"EPSG:3857", "EPSG:2056"));

//Projections['ch_lv95'] = Projections.createProj("2056", [2420000, 1030000, 2900000, 1350000]);
//Projections['ch_lv03'] = Projections.createProj("21781", transformExtent(Projections['ch_lv95'].getExtent(), "EPSG:2056", "EPSG:21781"));
Projections['ch_lv95'] = Projections.createProj("2056", [2420000, 1030000, 2900000, 1350000]);
Projections['ch_lv03'] = Projections.createProj("21781");
Projections['google'] = Projections.createProj("3857");
Projections['wgs'] = Projections.createProj("4326", transformExtent(Projections['ch_lv95'].getExtent(), "EPSG:2056", "EPSG:4326"));
Projections['used'] = Projections['wgs'];

var wmts_4326 = {
  "urls": ["https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/{Time}/4326/{TileMatrix}/{TileCol}/{TileRow}.jpeg"],
  "layer":"ch.swisstopo.pixelkarte-farbe",
  "matrixSet":"4326_18",
  "format":"image/jpeg",
  "projection":{
    "code_":"EPSG:4326",
    "units_":"degrees",
    "extent_":[-180,-90,180,90],
    "worldExtent_":[-180,-90,180,90],
    "axisOrientation_":"neu",
    "global_":true,
    "canWrapX_":true,
    "defaultTileGrid_":null,
    "metersPerUnit_":111319.49079327358
  },
  "requestEncoding":"REST",
  "tileGrid":{
    "minZoom":0,
    "resolutions_": [0.7031249999990972,0.3515624999995486,0.17578125000002584,0.08789062500001292,0.04394531250000646,0.02197265625000323,0.010986328124989037,0.005493164062494518,0.002746582031247259,0.0013732910156261451,0.0006866455078130726,0.00034332275390527866,0.00017166137695314235,0.00008583068847657117,0.00004291534423828559,0.000021457672119142793,0.000010728836059571397,0.000005364418029785698,0.0000026822090148802733],
    "maxZoom":18,
    "origin_":null,
    "origins_":[[-180,90],[-180,90],[-180,90],[-180,90],[-180,90],[-180,90],[-180,90],[-180,90],[-180,90],[-180,90],[-180,90],[-180,90],[-180,90],[-180,90],[-180,90],[-180,90],[-180,90],[-180,90],[-180,90]],
    "tileSizes_":[256,256,256,256,256,256,256,256,256,256,256,256,256,256,256,256,256,256,256],
    "tileSize_":null,
    "extent_":[5.140242,45.398181,11.47757,48.230651],
    "fullTileRanges_":[{"minX":0,"maxX":1,"minY":-1,"maxY":-1},{"minX":0,"maxX":3,"minY":-2,"maxY":-1},{"minX":0,"maxX":7,"minY":-4,"maxY":-1},{"minX":0,"maxX":15,"minY":-8,"maxY":-1},{"minX":0,"maxX":31,"minY":-16,"maxY":-1},{"minX":0,"maxX":63,"minY":-32,"maxY":-1},{"minX":0,"maxX":127,"minY":-64,"maxY":-1},{"minX":0,"maxX":255,"minY":-128,"maxY":-1},{"minX":0,"maxX":511,"minY":-256,"maxY":-1},{"minX":0,"maxX":1023,"minY":-512,"maxY":-1},{"minX":0,"maxX":2047,"minY":-1024,"maxY":-1},{"minX":0,"maxX":4095,"minY":-2048,"maxY":-1},{"minX":0,"maxX":8191,"minY":-4096,"maxY":-1},{"minX":0,"maxX":16383,"minY":-8192,"maxY":-1},{"minX":0,"maxX":32767,"minY":-16384,"maxY":-1},{"minX":0,"maxX":65535,"minY":-32768,"maxY":-1},{"minX":0,"maxX":131071,"minY":-65536,"maxY":-1},{"minX":0,"maxX":262143,"minY":-131072,"maxY":-1},{"minX":0,"maxX":524287,"minY":-262144,"maxY":-1}],
    "tmpSize_":[0,0],
    "matrixIds_":["0","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18"]
  },
  "style":"ch.swisstopo.pixelkarte-farbe",
  "dimensions":{"Time":"current"},
  "wrapX":false
}



console.log(getWidth(Projections['ch_lv95'].getExtent()));
var size = getWidth(Projections['wgs'].getExtent()) / 256;
var resolutions = new Array(18);
var matrixIds = new Array(18);
for (var z = 0; z < 18; ++z) {
  // generate resolutions and matrixIds arrays for this WMTS
  resolutions[z] = size / Math.pow(2, z);
  matrixIds[z] = z;
}
//var resolutions = RESOLUTIONS;

console.log(resolutions);

console.log(Projections['wgs'])

function getBoundsAndMaxResForWMTS(scaleDenominator, topLeftCorner, tileWidth, matrixWidth, tileHeight, matrixHeight) {

  var standardizedRenderingPixelSize = 0.00028;

  var widthPixel = tileWidth * matrixWidth;
  var heightPixel = tileHeight * matrixHeight;

  var right = (scaleDenominator * widthPixel * standardizedRenderingPixelSize) +  topLeftCorner.x;
  var bottom = topLeftCorner.y - (scaleDenominator * heightPixel * standardizedRenderingPixelSize) ;
  console.log("fo")
  var bounds = transformExtent([topLeftCorner.x, bottom, right, topLeftCorner.y], "EPSG:4326", "EPSG:4326");
  var maxResolutionW = (right - topLeftCorner.x) / widthPixel;
  var maxResolutionH = (topLeftCorner.y - bottom) / heightPixel;

  if (maxResolutionW !== maxResolutionH) {
      throw new Error('Could not calculate ');
  }

  return {
      bounds: bounds,
      maxResolution: maxResolutionW
  };
}
console.log(getBoundsAndMaxResForWMTS(69885283.0036, {x: -180, y: 90}, 256, 4, 256, 2));





var mousePositionControl = new MousePosition({
  coordinateFormat: createStringXY(4),

  // comment the following two lines to have the mouse position
  // be placed within the map.
  className: 'custom-mouse-position',
  target: document.getElementById('mouse-position'),
  undefinedHTML: '&nbsp;'
});

const wmtsSource = function(layer, options) {
  //var resolutions = options.resolutions ? options.resolutions : RESOLUTIONS;
  
  var resolutions = wmts_4326.tileGrid.resolutions_;
  
  var tileGrid = new TileGrid({
    origin: [wmts_4326.tileGrid.extent_[0], wmts_4326.tileGrid.extent_[3]],
    resolutions: wmts_4326.tileGrid.resolutions_,
    matrixIds: wmts_4326.tileGrid.matrixIds_
  });
  var extension = options.format || "png";
  var timestamp = options.timestamp || options["timestamps"][0];
  return new WMTS({
    url:
      (
        "//wmts.geo.admin.ch" +
        "/1.0.0/{Layer}/default/" +
        timestamp + "/" +
        options.projection.epsg + "/" +
        "{TileMatrix}/{TileCol}/{TileRow}."
      ).replace("http:", location.protocol) + extension,
    tileGrid: tileGrid,
    matrixSet: wmts_4326.matrixSet,
    projection: options.projection,
    layer: options["serverLayerName"] ? options["serverLayerName"] : layer,
    requestEncoding: "REST"
  });
};
/*
const wmtsSource2 = function(layername, timestamp) {
  return
    new XYZ({
      url: 'https://wmts10.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/4326/{z}/{x}/{y}.jpeg'
    });
}
*/


var baseConfig = {
  attribution: "swisstopo",
  format: "jpeg",
  serverLayerName: "ch.swisstopo.pixelkarte-farbe",
  attributionUrl:
    "https://www.swisstopo.admin.ch/internet/swisstopo/fr/home.html",
  timestamps: ["current"],
  label: "ch.swisstopo.pixelkarte-farbe_farbe",
  type: "wmts",
  projection: Projections['wgs'],
  resolutions: resolutions
};

var baseLayer = new TileLayer({
  source: wmtsSource(baseConfig.serverLayerName, baseConfig)
});

/*
var wmsLayer = new ImageLayer({
  extent: Projections['ch_lv95'].getExtent(),
  source: new ImageWMS({
    url: "https://wms.geo.admin.ch/",
    ratio: 1.0,
    projection: "EPSG:2056",
    params: {
      LAYERS: ["org.epsg.grid_21781"],
      FORMAT: "image/png",
      TILED: false
    },
    serverType: "mapserver"
  })
});
*/

const ol2d = new Map({
  controls: defaultControls().extend([mousePositionControl]),
  target: 'map',
  layers: [/*
    new TileLayer({
      source: new OSM()
    }),*/
    baseLayer
  ],
  view: new View({
/*
    center: transform([2721200, 1258050], "EPSG:2056", "EPSG:3857"),
    zoom: 7,
    projection: Projections['google']
*/
center: transform([2801801.50, 1133424.88], "EPSG:2056", "EPSG:2056"),
resolution: 2,
projection: Projections['ch_lv95']

  })
});


//console.log(fromLonLat([8.029, 46.908], Projections['used']));


const ol3d = new OLCesium({map: ol2d, target: "map3d"});
const scene = ol3d.getCesiumScene();
scene.terrainProvider = new Cesium.CesiumTerrainProvider({
  url:
    "//3d.geo.admin.ch/1.0.0/ch.swisstopo.terrain.3d/default/20160115/4326/"
});
/*
scene.imageryProvider = new Cesium.UrlTemplateImageryProvider({
  // Aerial image
  //url: "//wmts20.geo.admin.ch/1.0.0/ch.swisstopo.swissimage-product/default/current/4326/{z}/{x}/{y}.jpeg",
  // Map
  url:
    "//wmts10.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-karte-farbe.3d/default/current/4326/{z}/{x}/{y}.jpeg",
  minimumLevel: 8,
  maximumLevel: 17,
  tilingScheme: new Cesium.GeographicTilingScheme({
    numberOfLevelZeroTilesX: 2,
    numberOfLevelZeroTilesY: 1
  }),
  rectangle: Cesium.Rectangle.fromDegrees(
    5.013926957923385,
    45.35600133779394,
    11.477436312994008,
    48.27502358353741
  )
  });
*/
//console.log("foo");

window.enable3D = function() {
  ol3d.setEnabled(true);
}
