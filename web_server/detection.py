import torch
import os

# Definisikan path model (naik satu folder ke root, lalu masuk ke business-logic)
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'business-logic', 'models', 'best.pt')

def get_prediction(image_bytes):
    # Load model (pastikan library yolov5/torch sudah terinstall)
    model = torch.hub.load('ultralytics/yolov5', 'custom', path=MODEL_PATH)
    
    # Lakukan deteksi
    results = model(image_bytes)
    
    # Kembalikan hasil dalam bentuk JSON atau koordinat
    return results.pandas().xyxy[0].to_json(orient="records")