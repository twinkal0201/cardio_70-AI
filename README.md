# CardioAI Dashboard - Quick Start Guide

## 🚀 Getting Started

## 🎨 Features
- HeartSense AI is an intelligent cardiovascular disease prediction web application. It combines machine learning, interactive UI, and real-time guidance to help users understand their heart health and take proactive measures.

This project uses a Randaom Forest model, prioritizing interpretability and transparency in health prediction

### ✅ Dashboard Sections
- **Dashboard**: Overview with statistics and charts
- **Patient Input**: Multi-step form with 11 medical parameters
- **Prediction Result**: Animated risk indicator with AI explanation
- **Model Performance**: Accuracy, precision, recall, F1-score, ROC curve
- **About Model**: Information about the AI model


### ✅ Charts & Analytics
- Risk distribution (doughnut chart)
- Project information
- Feature importance 
- Confusion matrix
- Risk by age group (stacked bar)

---

## 🎯 Usage Tips

1. **Dark/Light Mode**: Click the sun/moon icon in the header
2. **Navigation**: Use the sidebar to switch between sections
3. **Patient Input**: Fill all 11 fields and click "Predict Risk"
4. **View Charts**: Navigate to different sections to see analytics
4. **prediction reslut**: Predict risk based on trained model give analysis 

---

### ✅ Technologies Used
- Python, Flask, HTML, CSS, JS, Scikit-learn, Pandas, NumPy, Render (cloud hosting).


## 🛠️ Troubleshooting

**Backend not connecting?**
- Ensure Flask server is running on valid port
- Check console for CORS errors
- The frontend will use model.pkl for prediction

**Charts not displaying?**
- Ensure app.js CDN is loaded
- Check browser console for errors
- Try refreshing the page

**Styling issues?**
- Clear browser cache
- Ensure `style.css` is in the same directory
- Check if browser supports `backdrop-filter` (for glassmorphism)

---

## 📊 Model Information

- **Algorithm**: Random Forest Classifier
- **Accuracy**: 73.67%
- **Features**: 11 clinical parameters
- **Training Samples**: 63k+ patient records

## 🔒 Medical Disclaimer

This tool is for educational and research purposes only. It should not replace professional medical advice, diagnosis, or treatment. Always consult with a qualified healthcare provider.

---
---

Enjoy using Cardio70! 🫀
