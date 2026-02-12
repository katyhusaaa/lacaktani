from flask import Flask, render_template, request, jsonify
from detection import get_prediction

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
        
    file = request.files['file']
    img_bytes = file.read()
    
    # Terima string base64 dari detection.py
    result_image = get_prediction(img_bytes)
    
    # Kirim balik ke frontend
    return jsonify({'image_data': result_image})

if __name__ == '__main__':
    app.run(debug=True, port=5000)