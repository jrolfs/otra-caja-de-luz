### Otra Caja De Luz

##### Yet another 🖼 implementation :)


#### Usage

- Include `ocdl.js`:

```html
  <script type="text/javascript" src="js/ocdl.js">
```

- Instantiate `OCDL.Gallery` with an "API adapter"
  - The adapter must implement the following:
    - A `url` property the represents the fully qualified URI of the API endpoint
    - A `headers` property that represents necessary request headers inthe form of an `Object`
    - Currently the only included adapter is the Imgur Reddit adapter, usage can be seen in the example
- Attach the gallery instance to the DOM using the `attach` method

```javascript
  var adapter = OCDL.imgur({ sub: 'funny', id: '[Imgur Client-ID]' });
  var gallery = new OCDL.Gallery({ adapter: adapter }).attach(document.body);
```


#### Development

```
  npm install
  gulp serve
```
