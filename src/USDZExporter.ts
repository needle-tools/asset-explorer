// import { Renderer } from '@needle-tools/engine';
// import { GameObject } from '@needle-tools/engine';
import {
	PlaneGeometry,
	Texture,
	Uniform,
	PerspectiveCamera,
	Scene,
	Mesh,
	ShaderMaterial,
	WebGLRenderer,
	MathUtils,
	Matrix4,
	RepeatWrapping,
	MirroredRepeatWrapping,
	DoubleSide,
	BufferGeometry,
	Material,
	Camera,
	Color,
	MeshStandardMaterial,
	sRGBEncoding,
	MeshPhysicalMaterial,
	Object3D,
	MeshBasicMaterial,
	SkinnedMesh,
	SRGBColorSpace,
} from 'three';
import * as fflate from 'three/examples/jsm/libs/fflate.module.js';

function makeNameSafe( str ) {
	str = str.replace( /[^a-zA-Z0-9_]/g, '' );

	// if str does not start with a-zA-Z_ add _ to the beginning
	if ( !str.match( /^[a-zA-Z_]/ ) )
		str = '_' + str;

	return str;
}

class USDObject {

	static USDObject_export_id = 0;
	
	uuid: string;
	name: string;
	matrix: Matrix4;
	private _isDynamic: boolean;
	get isDynamic() { return this._isDynamic; }
	private set isDynamic( value ) { this._isDynamic = value; }
	geometry: BufferGeometry | null;
	material: Material | null;
	camera: Camera | null;
	parent: USDObject | null;
	children: Array<USDObject | null> = [];
	_eventListeners: {};

	static createEmptyParent( object ) {

		const emptyParent = new USDObject( MathUtils.generateUUID(), object.name + '_empty_' + ( USDObject.USDObject_export_id ++ ), object.matrix );
		const parent = object.parent;
		parent.add( emptyParent );
		emptyParent.add( object );
		emptyParent.isDynamic = true;
		object.matrix = new Matrix4().identity();
		return emptyParent;

	}

	static createEmpty() {
		
		const empty = new USDObject( MathUtils.generateUUID(), 'Empty_' + ( USDObject.USDObject_export_id ++ ), new Matrix4() );
		empty.isDynamic = true;
		return empty;
	}

	constructor( id, name, matrix, mesh: BufferGeometry | null = null, material: Material | null = null, camera: Camera | null = null ) {

		this.uuid = id;
		this.name = makeNameSafe( name );
		this.matrix = matrix;
		this.geometry = mesh;
		this.material = material;
		this.camera = camera;
		this.parent = null;
		this.children = [];
		this._eventListeners = {};
		this._isDynamic = false;

	}

	is( obj ) {

		if ( ! obj ) return false;
		return this.uuid === obj.uuid;

	}

	isEmpty() {

		return ! this.geometry;

	}

	clone() {

		const clone = new USDObject( MathUtils.generateUUID(), this.name, this.matrix, this.geometry, this.material );
		clone.isDynamic = this.isDynamic;
		return clone;

	}

	getPath() {

		let current = this.parent;
		let path = this.name;
		while ( current ) {

			path = current.name + '/' + path;
			current = current.parent;

		}

		return '</' + path + '>';

	}

	add( child ) {

		if ( child.parent ) {

			child.parent.remove( child );

		}

		child.parent = this;
		this.children.push( child );

	}

	remove( child ) {

		const index = this.children.indexOf( child );
		if ( index >= 0 ) {

			if ( child.parent === this ) child.parent = null;
			this.children.splice( index, 1 );

		}

	}

	addEventListener( evt, listener ) {

		if ( ! this._eventListeners[ evt ] ) this._eventListeners[ evt ] = [];
		this._eventListeners[ evt ].push( listener );

	}

	removeEventListener( evt, listener ) {

		if ( ! this._eventListeners[ evt ] ) return;
		const index = this._eventListeners[ evt ].indexOf( listener );
		if ( index >= 0 ) {

			this._eventListeners[ evt ].splice( index, 1 );

		}

	}

	onSerialize( writer, context ) {

		const listeners = this._eventListeners[ 'serialize' ];
		if ( listeners ) listeners.forEach( listener => listener( writer, context ) );

	}

}


class USDDocument extends USDObject {

	stageLength: number;

	get isDocumentRoot() {

		return true;

	}
	get isDynamic() {

		return false;

	}

	constructor() {

		super(undefined, 'StageRoot', new Matrix4(), null, null, null);
		this.children = [];
		this.stageLength = 200;

	}

	add( child: USDObject ) {

		child.parent = this;
		this.children.push( child );

	}

	remove( child: USDObject ) {

		const index = this.children.indexOf( child );
		if ( index >= 0 ) {

			if ( child.parent === this ) child.parent = null;
			this.children.splice( index, 1 );

		}

	}

	traverse( callback, current: USDObject | null = null ) {

		if ( current !== null ) callback( current );
		else current = this;
		if ( current.children ) {

			for ( const child of current.children ) {

				this.traverse( callback, child );

			}

		}

	}

	findById( uuid ) {

		let found = false;
		function search( current ) {

			if ( found ) return;
			if ( current.uuid === uuid ) {

				found = true;
				return current;

			}

			if ( current.children ) {

				for ( const child of current.children ) {

					const res = search( child );
					if ( res ) return res;

				}

			}

		}

		return search( this );

	}


	buildHeader() {

		return `#usda 1.0
(
	customLayerData = {
		string creator = "Three.js USDZExporter"
	}
	defaultPrim = "${makeNameSafe( this.name )}"
	metersPerUnit = 1
	upAxis = "Y"
	startTimeCode = 0
	endTimeCode = ${this.stageLength}
	timeCodesPerSecond = 60
	framesPerSecond = 60
)
`;

	}

}

const newLine = '\n';

class USDWriter {
	str: string;
	indent: number;

	constructor() {

		this.str = '';
		this.indent = 0;

	}

	clear() {

		this.str = '';
		this.indent = 0;

	}

	beginBlock( str ) {

		str = this.applyIndent( str );
		this.str += str;
		this.str += newLine;
		this.str += this.applyIndent( '{' );
		this.str += newLine;
		this.indent += 1;

	}

	closeBlock() {

		this.indent -= 1;
		this.str += this.applyIndent( '}' ) + newLine;

	}

	beginArray( str ) {

		str = this.applyIndent( str + ' = [' );
		this.str += str;
		this.str += newLine;
		this.indent += 1;

	}

	closeArray() {

		this.indent -= 1;
		this.str += this.applyIndent( ']' ) + newLine;

	}

	appendLine( str = '' ) {

		str = this.applyIndent( str );
		this.str += str;
		this.str += newLine;

	}

	toString() {

		return this.str;

	}

	applyIndent( str ) {

		let indents = '';
		for ( let i = 0; i < this.indent; i ++ ) indents += '\t';
		return indents + str;

	}

}

class USDZExporterContext {
	root: any;
	exporter: any;
	extensions: any;
	materials: {};
	textures: {};
	files: {};
	document: USDDocument;
	output: string;

	constructor( root, exporter, extensions ) {

		this.root = root;
		this.exporter = exporter;

		if ( extensions )
			this.extensions = extensions;

		this.materials = {};
		this.textures = {};
		this.files = {};
		this.document = new USDDocument();
		this.output = '';

	}

}

/**[documentation](https://developer.apple.com/documentation/arkit/usdz_schemas_for_ar/preliminary_anchoringapi/preliminary_anchoring_type) */
export type Anchoring = "plane" | "image" | "face" | "none"
/**[documentation](https://developer.apple.com/documentation/arkit/usdz_schemas_for_ar/preliminary_anchoringapi/preliminary_planeanchoring_alignment) */
export type Alignment = "horizontal" | "vertical" | "any";

class USDZExporterOptions {
	ar: {
		anchoring: { type: Anchoring },
		planeAnchoring: { alignment: Alignment },
	} = { 
		anchoring: { type: 'plane' },
		planeAnchoring: { alignment: 'horizontal' }
	};
	quickLookCompatible: boolean = false;
	extensions: any[] = [];
}

class USDZExporter {
	debug: boolean;
	sceneAnchoringOptions: {} = {};
	extensions: any;

	constructor() {

		this.debug = false;

	}

	async parse( scene, options: USDZExporterOptions = new USDZExporterOptions() ) {

		options = Object.assign( new USDZExporterOptions(), options );

		this.sceneAnchoringOptions = options;
		// @ts-ignore
		const context = new USDZExporterContext( scene, this, options.extensions );
		this.extensions = context.extensions;

		const files = context.files;
		const modelFileName = 'model.usda';

		// model file should be first in USDZ archive so we init it here
		files[ modelFileName ] = null;

		const materials = context.materials;
		const textures = context.textures;

		await invokeAll( context, 'onBeforeBuildDocument' );

		traverseVisible( scene, context.document, context );

		await invokeAll( context, 'onAfterBuildDocument' );

		parseDocument( context );

		await invokeAll( context, 'onAfterSerialize' );

		context.output += buildMaterials( materials, textures, options.quickLookCompatible );

		const header = context.document.buildHeader();
		const final = header + '\n' + context.output;

		// full output file
		if ( this.debug )
			console.log( final );

		files[ modelFileName ] = fflate.strToU8( final );
		context.output = '';

		for ( const id in textures ) {

			let texture = textures[ id ];
			const isRGBA = texture.format === 1023;
			if ( texture.isCompressedTexture ) {

				texture = copyTexture( texture );

			}
            
            // HACK using custom data type to pass through texture data.
			// We should actually respect the texture file type here, besides not doing this at all.
			if (texture.source.data.hasArrayBuffer) {
				files[ `textures/Texture_${ id }.png` ] = new Uint8Array( await texture.source.data.getArrayBuffer() );
				continue;
			}

			// TODO add readback options for textures that don't have texture.image
			const canvas = await imageToCanvas( texture.image );

			if ( canvas ) {

				const blob = await new Promise( resolve => canvas.toBlob( resolve, isRGBA ? 'image/png' : 'image/jpeg', 0.95 ) ) as any;
				files[ `textures/Texture_${id}.${isRGBA ? 'png' : 'jpg'}` ] = new Uint8Array( await blob.arrayBuffer() );

			} else {

				console.warn( 'Can`t export texture: ', texture );

			}

		}

		// 64 byte alignment
		// https://github.com/101arrowz/fflate/issues/39#issuecomment-777263109

		let offset = 0;

		for ( const filename in files ) {

			const file = files[ filename ];
			const headerSize = 34 + filename.length;

			offset += headerSize;

			const offsetMod64 = offset & 63;

			if ( offsetMod64 !== 4 ) {

				const padLength = 64 - offsetMod64;
				const padding = new Uint8Array( padLength );

				files[ filename ] = [ file, { extra: { 12345: padding } } ];

			}

			offset = file.length;

		}

		return fflate.zipSync( files, { level: 0 } );

	}

}

function traverseVisible( object: Object3D, parentModel: USDObject, context: USDZExporterContext ) {

	if ( ! object.visible ) return;
	
	let model: USDObject | undefined = undefined;
	let geometry: BufferGeometry | undefined = undefined;
	let material: Material | Material[] | undefined = undefined;
	
	if (object instanceof Mesh) {
		geometry = object.geometry;
		material = object.material;
	}

	// TODO what should be do with disabled renderers?
	// Here we just assume they're off, and don't export them
	/*
    const renderer = GameObject.getComponent( object, Renderer )
	if (renderer && !renderer.enabled) {
		geometry = undefined;
		material = undefined;
	}
    */

	if ( object instanceof Mesh && material && (material instanceof MeshStandardMaterial || material instanceof MeshBasicMaterial) && ! (object instanceof SkinnedMesh )) {

		const name = getObjectId( object );
		model = new USDObject( object.uuid, name, object.matrix, geometry, material );

	} else if ( object instanceof Camera ) {

		const name = getObjectId( object );
		model = new USDObject( object.uuid, name, object.matrix, undefined, undefined, object );

	} else {

		const name = getObjectId( object );
		model = new USDObject( object.uuid, name, object.matrix );

	}

	if ( model ) {

		if ( parentModel ) {

			parentModel.add( model );

		}

		parentModel = model;

		if ( context.extensions ) {

			for ( const ext of context.extensions ) {

				if ( ext.onExportObject ) ext.onExportObject.call( ext, object, model, context );

			}

		}

	} else {

		const name = getObjectId( object );
		const empty = new USDObject( object.uuid, name, object.matrix );
		if ( parentModel ) {

			parentModel.add( empty );

		}

		parentModel = empty;

	}

	for ( const ch of object.children ) {

		traverseVisible( ch, parentModel, context );

	}

}

async function parseDocument( context: USDZExporterContext ) {

	for ( const child of context.document.children ) {

		addResources( child, context );

	}

	const writer = new USDWriter();

	writer.beginBlock( `def Xform "${context.document.name}"` );

	writer.beginBlock( `def Scope "Scenes" (
			kind = "sceneLibrary"
		)` );

	writer.beginBlock( `def Xform "Scene" (
			apiSchemas = ["Preliminary_AnchoringAPI"]
			customData = {
				bool preliminary_collidesWithEnvironment = 0
				string sceneName = "Scene"
			}
			sceneName = "Scene"
		)` );

	writer.appendLine( `token preliminary:anchoring:type = "${context.exporter.sceneAnchoringOptions.ar.anchoring.type}"` );
	if (context.exporter.sceneAnchoringOptions.ar.anchoring.type === 'plane')
		writer.appendLine( `token preliminary:planeAnchoring:alignment = "${context.exporter.sceneAnchoringOptions.ar.planeAnchoring.alignment}"` );
	// bit hacky as we don't have a callback here yet. Relies on the fact that the image is named identical in the ImageTracking extension.
	if (context.exporter.sceneAnchoringOptions.ar.anchoring.type === 'image')
		writer.appendLine( `rel preliminary:imageAnchoring:referenceImage = </${context.document.name}/Scenes/Scene/AnchoringReferenceImage>` );
	writer.appendLine();

	for ( const child of context.document.children ) {

		buildXform( child, writer, context );

	}

	invokeAll( context, 'onAfterHierarchy', writer );

	writer.closeBlock();
	writer.closeBlock();
	writer.closeBlock();

	context.output += writer.toString();

}

function addResources( object, context: USDZExporterContext ) {

	const geometry = object.geometry;
	let material = object.material;

	if ( geometry ) {

		if ( material.isMeshStandardMaterial || material.isMeshBasicMaterial )  { // TODO convert unlit to lit+emissive

			const geometryFileName = 'geometries/Geometry_' + geometry.id + '.usd';

			if ( ! ( geometryFileName in context.files ) ) {

				const meshObject = buildMeshObject( geometry );
				context.files[ geometryFileName ] = buildUSDFileAsString( meshObject, context );

			}

		} else {

			console.warn( 'THREE.USDZExporter: Unsupported material type (USDZ only supports MeshStandardMaterial)', name );

		}

	}

	if( material ) {
		
		if ( ! ( material.uuid in context.materials ) ) {

			context.materials[ material.uuid ] = material;

		}
	}

	for ( const ch of object.children ) {

		addResources( ch, context );

	}

}

async function invokeAll( context: USDZExporterContext, name: string, writer: USDWriter | null = null ) {

	if ( context.extensions ) {

		for ( const ext of context.extensions ) {

			if ( !ext ) continue;

			if ( typeof ext[ name ] === 'function' ) {

				const method = ext[ name ];
				const res = method.call( ext, context, writer );
				if(res instanceof Promise) {
					await res;
				}
			}

		}

	}

}

function copyTexture( texture : Texture ) {

	const geometry = new PlaneGeometry( 2, 2, 1, 1 );
	const material = new ShaderMaterial( {
		uniforms: {
			blitTexture: new Uniform( texture ),
		},
		defines: {
			IS_SRGB: texture.colorSpace == SRGBColorSpace,
		},
        vertexShader: `
            varying vec2 vUv;
            void main(){
                vUv = uv;
				vUv.y = 1. - vUv.y;
                gl_Position = vec4(position.xy * 1.0,0.,.999999);
            }`,
        fragmentShader: `
            uniform sampler2D blitTexture; 
            varying vec2 vUv;

            // took from threejs 05fc79cd52b79e8c3e8dec1e7dca72c5c39983a4
            vec4 conv_LinearTosRGB( in vec4 value ) {
                return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
            }

            void main(){ 
                gl_FragColor = vec4(vUv.xy, 0, 1);
                
                #ifdef IS_SRGB
                gl_FragColor = conv_LinearTosRGB( texture2D( blitTexture, vUv) );
                #else
                gl_FragColor = texture2D( blitTexture, vUv);
                #endif
            }`
    } );

	const mesh = new Mesh( geometry, material );
	mesh.frustumCulled = false;
	const cam = new PerspectiveCamera();
	const scene = new Scene();
	scene.add( mesh );
	const renderer = new WebGLRenderer( { antialias: false } );
	renderer.setSize( texture.image.width, texture.image.height );
	renderer.clear();
	renderer.render( scene, cam );

	const tex = new Texture( renderer.domElement );
	tex.colorSpace = texture.colorSpace;
	return tex;

}


function isImageBitmap( image ) {

	return ( typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement ) ||
		( typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement ) ||
		( typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas ) ||
		( typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap ) ;

}

async function imageToCanvas( image, color: string | undefined = undefined, flipY = false ) {

	if ( isImageBitmap( image ) ) {

		// max. canvas size on Safari is still 4096x4096
		const scale = 4096 / Math.max( image.width, image.height );

		const canvas = document.createElement( 'canvas' );
		canvas.width = image.width * Math.min( 1, scale );
		canvas.height = image.height * Math.min( 1, scale );

		const context = canvas.getContext( '2d' );
		if (!context) throw new Error('Could not get canvas 2D context');

		if ( flipY === true ) {

			context.translate( 0, canvas.height );
			context.scale( 1, - 1 );

		}

		context.drawImage( image, 0, 0, canvas.width, canvas.height );

		// TODO remove, not used anymore
		if ( color !== undefined ) {

			const hex = parseInt( color, 16 );

			const r = ( hex >> 16 & 255 ) / 255;
			const g = ( hex >> 8 & 255 ) / 255;
			const b = ( hex & 255 ) / 255;

			const imagedata = context.getImageData( 0, 0, canvas.width, canvas.height );
			const data = imagedata.data;

			for ( let i = 0; i < data.length; i += 4 ) {

				data[ i + 0 ] = data[ i + 0 ] * r;
				data[ i + 1 ] = data[ i + 1 ] * g;
				data[ i + 2 ] = data[ i + 2 ] * b;

			}

			context.putImageData( imagedata, 0, 0 );

		}

		return canvas;

	} else {

		throw new Error( 'THREE.USDZExporter: No valid image data found. Unable to process texture.' );

	}

}

//

const PRECISION = 7;

function buildHeader() {

	return `#usda 1.0
(
    customLayerData = {
        string creator = "Three.js USDZExporter"
    }
    metersPerUnit = 1
    upAxis = "Y"
)
`;

}

function buildUSDFileAsString( dataToInsert, _context: USDZExporterContext ) {

	let output = buildHeader();
	output += dataToInsert;
	return fflate.strToU8( output );

}

function getObjectId( object ) {

	return object.name.replace( /[-<>\(\)\[\]§$%&\/\\\=\?\,\;]/g, '' ) + '_' + object.id;

}

// Xform

export function buildXform( model, writer, context ) {

	const matrix = model.matrix;
	const geometry = model.geometry;
	const material = model.material;
	const camera = model.camera;
	const name = model.name;

	// postprocess node
	if ( model.onBeforeSerialize ) {

		model.onBeforeSerialize( writer, context );

	}

	const transform = buildMatrix( matrix );

	if ( matrix.determinant() < 0 ) {

		console.warn( 'THREE.USDZExporter: USDZ does not support negative scales', name );

	}

	if ( geometry ) {
		writer.beginBlock( `def Xform "${name}" (
prepend references = @./geometries/Geometry_${geometry.id}.usd@</Geometry>
prepend apiSchemas = ["MaterialBindingAPI"]
		)` );
	}
	else if ( camera )
		writer.beginBlock( `def Camera "${name}"` );
	else
		writer.beginBlock( `def Xform "${name}"` );

	if ( material )
		writer.appendLine( `rel material:binding = </Materials/Material_${material.id}>` );
	writer.appendLine( `matrix4d xformOp:transform = ${transform}` );
	writer.appendLine( 'uniform token[] xformOpOrder = ["xformOp:transform"]' );

	if ( camera ) {

		if ( camera.isOrthographicCamera ) {

			writer.appendLine( `float2 clippingRange = (${camera.near}, ${camera.far})` );
			writer.appendLine( `float horizontalAperture = ${( ( Math.abs( camera.left ) + Math.abs( camera.right ) ) * 10 ).toPrecision( PRECISION )}` );
			writer.appendLine( `float verticalAperture = ${( ( Math.abs( camera.top ) + Math.abs( camera.bottom ) ) * 10 ).toPrecision( PRECISION )}` );
			writer.appendLine( 'token projection = "orthographic"' );

		} else {

			writer.appendLine( `float2 clippingRange = (${camera.near.toPrecision( PRECISION )}, ${camera.far.toPrecision( PRECISION )})` );
			writer.appendLine( `float focalLength = ${camera.getFocalLength().toPrecision( PRECISION )}` );
			writer.appendLine( `float focusDistance = ${camera.focus.toPrecision( PRECISION )}` );
			writer.appendLine( `float horizontalAperture = ${camera.getFilmWidth().toPrecision( PRECISION )}` );
			writer.appendLine( 'token projection = "perspective"' );
			writer.appendLine( `float verticalAperture = ${camera.getFilmHeight().toPrecision( PRECISION )}` );

		}

	}

	if ( model.onSerialize ) {

		model.onSerialize( writer, context );

	}

	if ( model.children ) {

		writer.appendLine();
		for ( const ch of model.children ) {

			buildXform( ch, writer, context );

		}

	}

	writer.closeBlock();

}

function fn( num ) {

	return num.toFixed( 10 );

}

function buildMatrix( matrix ) {

	const array = matrix.elements;

	return `( ${buildMatrixRow( array, 0 )}, ${buildMatrixRow( array, 4 )}, ${buildMatrixRow( array, 8 )}, ${buildMatrixRow( array, 12 )} )`;

}

function buildMatrixRow( array, offset ) {

	return `(${fn( array[ offset + 0 ] )}, ${fn( array[ offset + 1 ] )}, ${fn( array[ offset + 2 ] )}, ${fn( array[ offset + 3 ] )})`;

}

// Mesh

function buildMeshObject( geometry ) {

	const mesh = buildMesh( geometry );
	return `
def "Geometry"
{
  ${mesh}
}
`;

}

function buildMesh( geometry ) {

	const name = 'Geometry';
	const attributes = geometry.attributes;
	const count = attributes.position.count;

	return `
    def Mesh "${name}"
    {
		float3[] extent = [${buildVector3(geometry.boundingBox.min)}, ${buildVector3(geometry.boundingBox.max)}]
        int[] faceVertexCounts = [${buildMeshVertexCount( geometry )}]
        int[] faceVertexIndices = [${buildMeshVertexIndices( geometry )}]
        normal3f[] normals = [${buildVector3Array( attributes.normal, count )}] (
            interpolation = "vertex"
        )
        point3f[] points = [${buildVector3Array( attributes.position, count )}]
        ${attributes.uv ?
		`texCoord2f[] primvars:st = [${buildVector2Array( attributes.uv, count )}] (
            interpolation = "vertex"
        )` : '' }
		${attributes.uv2 ?
		`texCoord2f[] primvars:st2 = [${buildVector2Array( attributes.uv2, count )}] (
            interpolation = "vertex"
        )` : '' }
        uniform token subdivisionScheme = "none"
    }
`;

}

function buildMeshVertexCount( geometry ) {

	const count = geometry.index !== null ? geometry.index.count : geometry.attributes.position.count;

	return Array( count / 3 ).fill( 3 ).join( ', ' );

}

function buildMeshVertexIndices( geometry: BufferGeometry ) {

	const index = geometry.index;
	const array: Array<number> = [];

	if ( index !== null ) {

		for ( let i = 0; i < index.count; i ++ ) {

			array.push( index.getX( i ) );

		}

	} else {

		const length = geometry.attributes.position.count;

		for ( let i = 0; i < length; i ++ ) {

			array.push( i );

		}

	}

	return array.join( ', ' );

}

function buildVector3Array( attribute, count ) {

	if ( attribute === undefined ) {

		console.warn( 'USDZExporter: Normals missing.' );
		return Array( count ).fill( '(0, 0, 0)' ).join( ', ' );

	}

	const array: Array<string> = [];

	for ( let i = 0; i < attribute.count; i ++ ) {

		const x = attribute.getX( i );
		const y = attribute.getY( i );
		const z = attribute.getZ( i );

		array.push( `(${x.toPrecision( PRECISION )}, ${y.toPrecision( PRECISION )}, ${z.toPrecision( PRECISION )})` );

	}

	return array.join( ', ' );

}

function buildVector2Array( attribute, count ) {

	if ( attribute === undefined ) {

		console.warn( 'USDZExporter: UVs missing.' );
		return Array( count ).fill( '(0, 0)' ).join( ', ' );

	}

	const array: Array<string> = [];

	for ( let i = 0; i < attribute.count; i ++ ) {

		const x = attribute.getX( i );
		const y = attribute.getY( i );

		array.push( `(${x.toPrecision( PRECISION )}, ${1 - y.toPrecision( PRECISION )})` );

	}

	return array.join( ', ' );

}

// Materials

function buildMaterials( materials, textures, quickLookCompatible = false ) {

	const array: Array<string> = [];

	for ( const uuid in materials ) {

		const material = materials[ uuid ];

		array.push( buildMaterial( material, textures, quickLookCompatible ) );

	}

	return `def "Materials"
{
${array.join( '' )}
}

`;

}

function buildMaterial( material: MeshBasicMaterial, textures, quickLookCompatible = false ) {

	// https://graphics.pixar.com/usd/docs/UsdPreviewSurface-Proposal.html

	const pad = '            ';
	const inputs: Array<string> = [];
	const samplers: Array<string> = [];

	function buildTexture( texture, mapType, color: Color | undefined = undefined, opacity: number | undefined = undefined ) {

		const id = texture.id + ( color ? '_' + color.getHexString() : '' ) + ( opacity ? '_' + opacity : '' );
		const isRGBA = texture.format === 1023;

		const wrapS = ( texture.wrapS == RepeatWrapping ) ? 'repeat' : ( texture.wrapS == MirroredRepeatWrapping ? 'mirror' : 'clamp' );
		const wrapT = ( texture.wrapT == RepeatWrapping ) ? 'repeat' : ( texture.wrapT == MirroredRepeatWrapping ? 'mirror' : 'clamp' );

		const repeat = texture.repeat.clone();
		const offset = texture.offset.clone();
		const rotation = texture.rotation;

		// rotation is around the wrong point. after rotation we need to shift offset again so that we're rotating around the right spot
		let xRotationOffset = Math.sin(rotation);
		let yRotationOffset = Math.cos(rotation);

		// texture coordinates start in the opposite corner, need to correct
		offset.y = 1 - offset.y - repeat.y;

		// turns out QuickLook is buggy and interprets texture repeat inverted.
		// Apple Feedback: 	FB10036297 and FB11442287
		if ( quickLookCompatible ) {

			// This is NOT correct yet in QuickLook, but comes close for a range of models.
			// It becomes more incorrect the bigger the offset is

			offset.x = offset.x / repeat.x;
			offset.y = offset.y / repeat.y;

			offset.x += xRotationOffset / repeat.x;
			offset.y += yRotationOffset - 1;
		}

		else {

			// results match glTF results exactly. verified correct in usdview.
			offset.x += xRotationOffset * repeat.x;
			offset.y += (1 - yRotationOffset) * repeat.y;

		}

		textures[ id ] = texture;
		const uvReader = mapType == 'occlusion' ? 'uvReader_st2' : 'uvReader_st';

		const needsTextureTransform = ( repeat.x != 1 || repeat.y != 1 || offset.x != 0 || offset.y != 0 || rotation != 0 );
		const textureTransformInput = `</Materials/Material_${material.id}/${uvReader}.outputs:result>`;
		const textureTransformOutput = `</Materials/Material_${material.id}/Transform2d_${mapType}.outputs:result>`;

		const needsTextureScale = mapType !== 'normal' && (color && (color.r !== 1 || color.g !== 1 || color.b !== 1 || opacity !== 1)) || false;
		const needsNormalScaleAndBias = mapType === 'normal';
		const normalScale = material instanceof MeshStandardMaterial ? (material.normalScale ? material.normalScale.x * 2 : 2) : 2;
		const normalScaleValueString = normalScale.toFixed( PRECISION );
		const normalBiasString = (-1 * (normalScale / 2)).toFixed( PRECISION );

		return `
        ${needsTextureTransform ? `def Shader "Transform2d_${mapType}" (
            sdrMetadata = {
                string role = "math"
            }
        )
        {
            uniform token info:id = "UsdTransform2d"
            float2 inputs:in.connect = ${textureTransformInput}
            float2 inputs:scale = ${buildVector2( repeat )}
            float2 inputs:translation = ${buildVector2( offset )}
			float inputs:rotation = ${(rotation / Math.PI * 180).toFixed( PRECISION )}
            float2 outputs:result
        }
		` : '' }
		def Shader "Texture_${texture.id}_${mapType}"
        {
            uniform token info:id = "UsdUVTexture"
            asset inputs:file = @textures/Texture_${id}.${isRGBA ? 'png' : 'jpg'}@
			token inputs:sourceColorSpace = "${ texture.colorSpace === 'srgb' ? 'sRGB' : 'raw' }"
            float2 inputs:st.connect = ${needsTextureTransform ? textureTransformOutput : textureTransformInput}
			${needsTextureScale ? `
			float4 inputs:scale = (${color ? color.r + ', ' + color.g + ', ' + color.b : '1, 1, 1'}, ${opacity ? opacity : '1'})
			` : `` }
			${needsNormalScaleAndBias ? `
			float4 inputs:scale = (${normalScaleValueString}, ${normalScaleValueString}, ${normalScaleValueString}, 1)
			float4 inputs:bias = (${normalBiasString}, ${normalBiasString}, ${normalBiasString}, 0)
			` : `` }
            token inputs:wrapS = "${wrapS}"
            token inputs:wrapT = "${wrapT}"
            float outputs:r
            float outputs:g
            float outputs:b
            float3 outputs:rgb
            ${material.transparent || material.alphaTest > 0.0 ? 'float outputs:a' : ''}
        }`;

	}

	const effectiveOpacity = ( material.transparent || material.alphaTest ) ? material.opacity : 1;

	if ( material.side === DoubleSide ) {

		console.warn( 'THREE.USDZExporter: USDZ does not support double sided materials', material.name );

	}

	if ( material.map !== null ) {

		inputs.push( `${pad}color3f inputs:diffuseColor.connect = </Materials/Material_${material.id}/Texture_${material.map.id}_diffuse.outputs:rgb>` );

		if ( material.transparent ) {

			inputs.push( `${pad}float inputs:opacity.connect = </Materials/Material_${material.id}/Texture_${material.map.id}_diffuse.outputs:a>` );

		} else if ( material.alphaTest > 0.0 ) {

			inputs.push( `${pad}float inputs:opacity.connect = </Materials/Material_${material.id}/Texture_${material.map.id}_diffuse.outputs:a>` );
			inputs.push( `${pad}float inputs:opacityThreshold = ${material.alphaTest}` );

		}

		samplers.push( buildTexture( material.map, 'diffuse', material.color, effectiveOpacity ) );

	} else {

		inputs.push( `${pad}color3f inputs:diffuseColor = ${buildColor( material.color )}` );

	}

	if ( material.aoMap ) {

		inputs.push( `${pad}float inputs:occlusion.connect = </Materials/Material_${material.id}/Texture_${material.aoMap.id}_occlusion.outputs:r>` );

		samplers.push( buildTexture( material.aoMap, 'occlusion' ) );

	}

	if ( material.alphaMap ) {

		inputs.push( `${pad}float inputs:opacity.connect = </Materials/Material_${material.id}/Texture_${material.alphaMap.id}_opacity.outputs:r>` );
		inputs.push( `${pad}float inputs:opacityThreshold = 0.0001` );

		samplers.push( buildTexture( material.alphaMap, 'opacity' ) );

	} else {

		inputs.push( `${pad}float inputs:opacity = ${effectiveOpacity}` );

	}

	if ( material instanceof MeshStandardMaterial ) { 

		if ( material.emissiveMap ) {

			inputs.push( `${pad}color3f inputs:emissiveColor.connect = </Materials/Material_${material.id}/Texture_${material.emissiveMap.id}_emissive.outputs:rgb>` );

			samplers.push( buildTexture( material.emissiveMap, 'emissive' ) );

		} else if ( material.emissive?.getHex() > 0 ) {

			inputs.push( `${pad}color3f inputs:emissiveColor = ${buildColor( material.emissive )}` );

		} else {
			
			inputs.push( `${pad}color3f inputs:emissiveColor = (0, 0, 0)` );

		}

		if ( material.normalMap ) {

			inputs.push( `${pad}normal3f inputs:normal.connect = </Materials/Material_${material.id}/Texture_${material.normalMap.id}_normal.outputs:rgb>` );

			samplers.push( buildTexture( material.normalMap, 'normal' ) );

		}

		if ( material.roughnessMap && material.roughness === 1 ) {

			inputs.push( `${pad}float inputs:roughness.connect = </Materials/Material_${material.id}/Texture_${material.roughnessMap.id}_roughness.outputs:g>` );

			samplers.push( buildTexture( material.roughnessMap, 'roughness' ) );

		} else {

			inputs.push( `${pad}float inputs:roughness = ${material.roughness !== undefined ? material.roughness : 1 }` );

		}

		if ( material.metalnessMap && material.metalness === 1 ) {

			inputs.push( `${pad}float inputs:metallic.connect = </Materials/Material_${material.id}/Texture_${material.metalnessMap.id}_metallic.outputs:b>` );

			samplers.push( buildTexture( material.metalnessMap, 'metallic' ) );

		} else {

			inputs.push( `${pad}float inputs:metallic = ${material.metalness !== undefined ? material.metalness : 0 }` );

		}

	}

	if ( material instanceof MeshPhysicalMaterial ) {

		inputs.push( `${pad}float inputs:clearcoat = ${material.clearcoat}` );
		inputs.push( `${pad}float inputs:clearcoatRoughness = ${material.clearcoatRoughness}` );
		inputs.push( `${pad}float inputs:ior = ${material.ior}` );

	}

	return `
    def Material "Material_${material.id}"
    {
        def Shader "PreviewSurface"
        {
            uniform token info:id = "UsdPreviewSurface"
${inputs.join( '\n' )}
            int inputs:useSpecularWorkflow = 0
            token outputs:surface
        }

        token outputs:surface.connect = </Materials/Material_${material.id}/PreviewSurface.outputs:surface>

        def Shader "uvReader_st"
        {
            uniform token info:id = "UsdPrimvarReader_float2"
            token inputs:varname = "st"
            float2 inputs:fallback = (0.0, 0.0)
            float2 outputs:result
        }

		def Shader "uvReader_st2"
        {
            uniform token info:id = "UsdPrimvarReader_float2"
            token inputs:varname = "st2"
            float2 inputs:fallback = (0.0, 0.0)
            float2 outputs:result
        }

${samplers.join( '\n' )}

    }
`;

}

function buildColor( color ) {

	return `(${color.r}, ${color.g}, ${color.b})`;

}

function buildVector2( vector ) {

	return `(${ vector.x }, ${ vector.y })`;

}

function buildVector3( vector ) {

	return `(${ vector.x }, ${ vector.y }, ${ vector.z })`;

}

export { USDZExporter, USDZExporterContext, USDWriter, USDObject, buildMatrix, USDDocument, makeNameSafe as makeNameSafeForUSD, imageToCanvas };