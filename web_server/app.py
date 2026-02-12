from flask import Flask, render_template, request
from detection import get_prediction

app = Flask(__name__)

@app.route('/')
def index():
    # Flask otomatis mencari di folder 'templates/index.html'
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if request.method == 'POST':
        file = request.files['file']
        img_bytes = file.read()
        
        # Panggil fungsi dari detection.py
        prediction = get_prediction(img_bytes)
        
        return prediction

if __name__ == '__main__':
    app.run(debug=True, port=5000)