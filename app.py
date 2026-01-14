"""
Cardio70 Backend - Flask API for Cardiovascular Disease Prediction
"""

from pyexpat import features
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pickle
import numpy as np
import os
import datetime

# Initialize Flask app to serve static files from current directory
app = Flask(__name__, static_url_path='', static_folder='.')
CORS(app)  # Enable CORS

# Load model
MODEL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'model1.pkl'))

model = None

print("\n" + "="*60)
print("🫀 Cardio70 Backend - Loading ML Models")
print("="*60)

try:
    with open(MODEL_PATH, 'rb') as f:
        model = pickle.load(f)
    print(f"✓ Model loaded successfully from {MODEL_PATH}")
except FileNotFoundError:
    print(f"⚠ Model file not found: {MODEL_PATH}")
except Exception as e:
    print(f"⚠ Error loading model: {e}")

print("="*60 + "\n")


def encode_cholesterol(value):
    """
    Encode Cholesterol (mg/dL) to Categorical (1, 2, 3)
    < 200 -> 1 (Normal)
    200 - 239 -> 2 (Above Normal)
    >= 240 -> 3 (Well Above Normal)
    """
    val = float(value)
    if val < 200: return 1
    elif val < 240: return 2
    else: return 3

def encode_glucose(value):
    """
    Encode Glucose (mg/dL) to Categorical (1, 2, 3)
    < 100 -> 1 (Normal)
    100 - 125 -> 2 (Above Normal)
    >= 126 -> 3 (Well Above Normal)
    """
    val = float(value)
    if val < 100: return 1
    elif val <= 125: return 2
    else: return 3


def generate_explanation(data, risk_level, risk_score, encoded_active_features):
    """Generate AI explanation based on patient data and prediction"""
    
    explanations = []
    
    # Age factor
    if int(data['age']) > 60:
        explanations.append("advanced age")
    
    # Cholesterol (mg/dL input)
    chol_val = float(data['cholesterol'])
    chol_cat = encoded_active_features['cholesterol_cat']
    if chol_cat == 3:
        explanations.append(f"critically high cholesterol levels ({chol_val} mg/dL, well above normal)")
    elif chol_cat == 2:
        explanations.append(f"elevated cholesterol levels ({chol_val} mg/dL, above normal)")
        
    # Glucose (mg/dL input)
    gluc_val = float(data['gluc'])
    gluc_cat = encoded_active_features['glucose_cat']
    if gluc_cat == 3:
        explanations.append(f"high fasting glucose levels ({gluc_val} mg/dL, indicative of diabetes)")
    elif gluc_cat == 2:
        explanations.append(f"elevated fasting glucose levels ({gluc_val} mg/dL, prediabetes range)")
    
    # Blood pressure
    if float(data['ap_hi']) > 140 or float(data['ap_lo']) > 90:
        explanations.append(f"hypertension ({data['ap_hi']}/{data['ap_lo']} mmHg)")
        
    # Lifestyle
    lifestyle_issues = []
    if int(data['smoke']) == 1:
        lifestyle_issues.append("smoking")
    if int(data['alco']) == 1:
        lifestyle_issues.append("alcohol consumption")
    if int(data['active']) == 0:
        lifestyle_issues.append("lack of physical activity")
    
    if lifestyle_issues:
        explanations.append(f"lifestyle factors ({', '.join(lifestyle_issues)})")
        
    # BMI Analysis
    height_m = float(data['height']) / 100
    weight_kg = float(data['weight'])
    bmi = weight_kg / (height_m * height_m)
    
    if bmi > 30:
        explanations.append(f"obesity (BMI {bmi:.1f})")
    elif bmi > 25:
        explanations.append(f"overweight status (BMI {bmi:.1f})")
    
    # Generate final explanation based on Risk Level
    if risk_level == 'low':
        if explanations:
            return f"Based on the provided patient data, the model predicts a low cardiovascular risk despite some concerns including {', '.join(explanations[:2])}. Overall vital signs are stable. Continue maintaining a healthy lifestyle."
        else:
            return "Based on the provided patient data, the model predicts a low cardiovascular risk. All vital parameters and lifestyle indicators appear to be within healthy ranges."
            
    elif risk_level == 'moderate':
        reasons = '; '.join(explanations[:3]) if explanations else "borderline clinical parameters"
        return f"Based on the provided patient data, the model predicts a moderate cardiovascular risk, primarily influenced by: {reasons}. Preventive measures and lifestyle adjustments are recommended."
        
    else:  # high risk
        reasons = '; '.join(explanations[:3]) if explanations else "multiple high-risk clinical factors"
        return f"Based on the provided patient data, the model predicts a high cardiovascular risk due to significant factors: {reasons}. Immediate consultation with a healthcare provider is strongly advised."



def safe_float(value, default=0.0):
    try:
        if value in ("", None):
            return default
        return float(value)
    except:
        return default


@app.route('/')
def home():
    """Serve the main frontend page"""
    return send_from_directory('.', 'index.html')


@app.route('/predict', methods=['POST','OPTIONS'])
def predict():
    """Predict cardiovascular disease risk"""
    
    try:
        # Get patient data from request
        # data = request.get_json()
        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({"status": "error", "message": "No input data received"}), 400

        
        # Cardio Dataset Features:
        # age (days), gender (1/2), height (cm), weight (kg), ap_hi, ap_lo, cholesterol (1/2/3), gluc (1/2/3), smoke (0/1), alco (0/1), active (0/1), bmi
        
        # 1. Age conversion: Model likely trained on DAYS.
        # age_years = float(data['age'])
        age_years = safe_float(data.get('age'))
        height_cm = safe_float(data.get('height'))
        weight_kg = safe_float(data.get('weight'))

        age_days = age_years * 365.25 # Keep days for model
        
        # 2. BMI Calculation
        height_cm = float(data['height'])
        weight_kg = float(data['weight'])
        bmi = weight_kg / ((height_cm / 100) ** 2)
        
        # 3. Categorical Encodings (mg/dL -> 1, 2, 3)
        cholesterol_cat = encode_cholesterol(data['cholesterol'])
        glucose_cat = encode_glucose(data['gluc'])
        
        # Extract features in correct order for model
        features = [
            age_days,                   # age in days
            int(data['gender']),        # gender
            height_cm,                  # height (cm)
            weight_kg,                  # weight (kg)
            float(data['ap_hi']),       # systolic bp
            float(data['ap_lo']),       # diastolic bp
            cholesterol_cat,            # cholesterol (1, 2, 3)
            glucose_cat,                # glucose (1, 2, 3)
            int(data['smoke']),         # smoking (0/1)
            int(data['alco']),          # alcohol (0/1)
            int(data['active']),        # physical activity (0/1)
            bmi                         # BMI (Calculated)
        ]
        
        # Convert to numpy array
        features_array = np.array(features, dtype=float).reshape(1, -1)
        
        # Encoded features dict for explanation generation
        encoded_features = {
            'cholesterol_cat': cholesterol_cat,
            'glucose_cat': glucose_cat
        }
        
        # Make prediction
        if model is not None:
            print('model prediction logic ussssssseeeeeeeeee::::::::')

             # Use features directly without scaling
            prediction = model.predict(features_array)[0]
            
            # Get prediction probability if available
            if hasattr(model, 'predict_proba'):
                proba = model.predict_proba(features_array)[0]
                confidence = float(max(proba) * 100)
                # Risk score is probability of class 1 (High Risk)
                risk_score = float(proba[1] * 100) if len(proba) > 1 else float(prediction * 100)
            else:
                confidence = 85.0
                risk_score = float(prediction * 100)
        else:
            return jsonify({
                "status": "error",
                "message": "Model not loaded on server"
            }), 500

        
        # Determine risk level
        if risk_score < 30:
            risk_level = 'low'
        elif risk_score < 70:
            risk_level = 'moderate'
        else:
            risk_level = 'high'
        
        # Generate explanation
        explanation = generate_explanation(data, risk_level, risk_score, encoded_features)
        
        # Return prediction result
        return jsonify({
            'prediction': int(prediction),
            'risk_level': risk_level,
            'risk_score': float(risk_score),
            'confidence': float(confidence),
            'explanation': explanation,
            'status': 'success',
            'timestamp': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 400


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None
    })


if __name__ == '__main__':
    print("\n" + "="*60)
    print("🫀 Cardio70 Backend Server")
    print("="*60)
    print(f"Model Status: {'✓ Loaded' if model is not None else '✗ Not Loaded'}")
    print("="*60)
    print("\nStarting server on http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
