document.addEventListener('DOMContentLoaded', () => {
    // Navigation & Sidebar Logic
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;

    // Theme Toggle
    themeToggle.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateChartsTheme();
    });

    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        html.setAttribute('data-theme', savedTheme);
    }

    // Navigation Logic
    // (Sidebar is now persistent via CSS)

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section');

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === `${sectionId}-section`) {
                    section.classList.add('active');
                }
            });
            window.scrollTo(0, 0);
        });
    });

    // Navigation Helper
    window.navigateToSection = (sectionId) => {
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-section') === sectionId) {
                item.classList.add('active');
            }
        });

        sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === `${sectionId}-section`) {
                section.classList.add('active');
            }
        });
        window.scrollTo(0, 0);
    };

    // Form Handling
    const form = document.getElementById('patientForm');
    const resetBtn = document.querySelector('.btn-secondary[onclick="resetForm()"]');

    window.resetForm = () => {
        form.reset();
        document.getElementById('ageValue').textContent = '50';
    };

    if (resetBtn) {
        resetBtn.onclick = window.resetForm;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('.btn-predict');
        submitBtn.classList.add('loading');
        document.getElementById('loadingOverlay').classList.add('active');

        // Collect Data
        const formData = new FormData(form);
        const data = {
            age: formData.get('age'),
            gender: formData.get('gender'),
            height: formData.get('height'),
            weight: formData.get('weight'),
            ap_hi: formData.get('ap_hi'),
            ap_lo: formData.get('ap_lo'),
            cholesterol: formData.get('cholesterol'),
            gluc: formData.get('gluc'),
            smoke: formData.get('smoke'),
            alco: formData.get('alco'),
            active: formData.get('active')
        };

        try {
            const response = await fetch('/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            const result = await response.json();

            if (result.status === 'success') {
                displayResult(result, data);
                navigateToSection('prediction-result');

                // Add calculation for report needing raw data
                const heightM = data.height / 100;
                result.bmi = (data.weight / (heightM * heightM)).toFixed(1);

                // Store for report
                window.currentPrediction = { result, inputData: data };
            } else {
                // showToast('Error: ' + (result.error || 'Unknown error'), 'error');
            }

        } catch (error) {
            console.error('Error:', error);
        } finally {
            submitBtn.classList.remove('loading');
            document.getElementById('loadingOverlay').classList.remove('active');
        }
    });

    function displayResult(result, inputData) {
        // Date
        const dateStr = result.timestamp || new Date().toLocaleString();
        document.getElementById('resultDate').textContent = "Prediction Date: " + dateStr;

        // Risk Level
        const riskLevel = document.getElementById('riskLevel');
        const riskPercentage = document.getElementById('riskPercentage');
        const riskIndicator = document.getElementById('riskIndicator');
        const riskProgress = document.getElementById('riskProgress');

        riskLevel.textContent = result.risk_level.charAt(0).toUpperCase() + result.risk_level.slice(1) + " Risk";
        riskPercentage.textContent = Math.round(result.risk_score) + "%";

        riskIndicator.className = `risk-indicator ${result.risk_level}`;

        const maxOffset = 565;
        const offset = maxOffset - (result.risk_score / 100 * maxOffset);
        riskProgress.style.strokeDashoffset = offset;

        // Confidence
        document.getElementById('confidenceValue').textContent = Math.round(result.confidence) + "%";
        document.getElementById('confidenceFill').style.width = result.confidence + "%";

        // Explanation
        document.getElementById('aiExplanation').textContent = result.explanation;
    }

    // Helper: Generate Clinical Interpretation
    function getClinicalInterpretation(data, riskLevel) {
        let advice = [];

        // Cholesterol
        if (data.cholesterol >= 240) advice.push("Reducing cholesterol intake and medication may be required.");
        else if (data.cholesterol >= 200) advice.push("Dietary changes to lower cholesterol are recommended.");

        // Glucose
        if (data.gluc >= 126) advice.push("Blood sugar management is critical; consult a specialist.");
        else if (data.gluc >= 100) advice.push("Monitor blood sugar levels and limit sugar intake.");

        // BP
        if (data.ap_hi >= 140 || data.ap_lo >= 90) advice.push("Blood pressure management through diet and exercise is advised.");

        // Lifestyle
        if (data.smoke == 1) advice.push("Stopping smoking is the single best step for heart health.");
        if (data.active == 0) advice.push("Incorporating regular moderate physical activity is highly beneficial.");
        if (data.weight / ((data.height / 100) ** 2) > 30) advice.push("Weight management strategies should be discussed with a provider.");

        if (advice.length === 0) {
            return "Maintain your current healthy lifestyle habits. Regular check-ups are still recommended.";
        }

        return "Clinical Interpretation (Advisory Only): " + advice.join(" ") + " Consult a healthcare professional for a personalized plan.";
    }

    // PDF Report Generation
    window.generateReport = () => {
        if (!window.currentPrediction) return;

        const { result, inputData } = window.currentPrediction;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const reportId = "ID-" + Math.random().toString(36).substr(2, 9).toUpperCase();
        const clinicalNote = getClinicalInterpretation(inputData, result.risk_level);

        // -- Header --
        doc.setFillColor(0, 188, 212);
        doc.rect(0, 0, 210, 40, 'F');

        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("Cardio70", 20, 20);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(14);
        doc.text("AI-Based Cardiovascular Risk Prediction Analysis", 20, 30);

        // Subtitle/Info line
        doc.setTextColor(240, 240, 240);
        doc.setFontSize(10);
        doc.text(`Report ID: ${reportId}   |   Date: ${new Date().toLocaleString()}`, 20, 38);

        // -- Patient Info Section --
        let y = 55;
        doc.setTextColor(0, 28, 60); // Dark Blue
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Patient Information", 20, y);

        // Draw a light line
        doc.setDrawColor(200, 200, 200);
        doc.line(20, y + 2, 190, y + 2);

        y += 10;
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);

        // Column 1
        doc.text(`Age: ${inputData.age} years`, 20, y);
        doc.text(`Gender: ${inputData.gender == 1 ? 'Male' : 'Female'}`, 110, y);
        y += 7;
        doc.text(`Height: ${inputData.height} cm`, 20, y);
        doc.text(`Weight: ${inputData.weight} kg`, 110, y);
        y += 7;
        doc.text(`Blood Pressure: ${inputData.ap_hi}/${inputData.ap_lo} mmHg`, 20, y);
        doc.text(`BMI: ${result.bmi}`, 110, y);
        y += 7;
        doc.text(`Cholesterol: ${inputData.cholesterol} mg/dL`, 20, y);
        doc.text(`Glucose: ${inputData.gluc} mg/dL`, 110, y);
        y += 7;
        doc.text(`Smoking: ${inputData.smoke == 1 ? 'Yes' : 'No'}`, 20, y);
        doc.text(`Alcohol: ${inputData.alco == 1 ? 'Yes' : 'No'}`, 110, y);
        y += 7;
        doc.text(`Physical Activity: ${inputData.active == 1 ? 'Yes' : 'No'}`, 20, y);

        // -- Prediction Summary --
        y += 15;
        doc.setTextColor(0, 28, 60);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Prediction Summary", 20, y);
        doc.line(20, y + 2, 190, y + 2);

        y += 12;
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("Predicted Cardiovascular Risk Level:", 20, y);

        // Highlight Risk
        doc.setFont("helvetica", "bold");
        let riskColor = [76, 175, 80]; // Green
        if (result.risk_level === 'high') riskColor = [255, 82, 82]; // Red
        if (result.risk_level === 'moderate') riskColor = [255, 152, 0]; // Orange

        doc.setTextColor(riskColor[0], riskColor[1], riskColor[2]);
        doc.text(result.risk_level.toUpperCase(), 100, y);

        y += 7;
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.text(`Prediction Confidence: ${Math.round(result.confidence)}%`, 20, y);

        y += 7;
        doc.text(`Risk Score: ${Math.round(result.risk_score)}%`, 20, y);

        // -- AI Explanation --
        y += 15;
        doc.setTextColor(0, 28, 60);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("AI Explanation", 20, y);
        doc.line(20, y + 2, 190, y + 2);

        y += 10;
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.setFont("helvetica", "normal");
        const explanationLines = doc.splitTextToSize(result.explanation, 170);
        doc.text(explanationLines, 20, y);
        y += (explanationLines.length * 6);

        // -- Clinical Interpretation --
        y += 10;
        doc.setTextColor(0, 28, 60);
        doc.setFont("helvetica", "bold");
        doc.text("Clinical Interpretation", 20, y);

        y += 8;
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.setFont("helvetica", "italic");
        const clinicalLines = doc.splitTextToSize(clinicalNote, 170);
        doc.text(clinicalLines, 20, y);

        y += (clinicalLines.length * 6) + 10;

        // -- Disclaimer --
        doc.setFillColor(245, 245, 245);
        doc.rect(15, 245, 180, 42, 'F');

        doc.setTextColor(100, 100, 100);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Disclaimer:", 20, 255);

        doc.setFont("helvetica", "normal");
        const disclaimerText = "This report is generated by an artificial intelligence (AI) model and is intended solely for educational and informational purposes. It does not constitute medical advice, diagnosis, or treatment. The predictions may not be hundred percentage accurate. Also consult a qualified healthcare professional adviser for medical evaluation and decisions.";
        const disclaimerLines = doc.splitTextToSize(disclaimerText, 170);
        doc.text(disclaimerLines, 20, 262);

        // -- Footer --
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("Generated by: Cardio70 - AI Health Prediction System", 20, 292);
        doc.text("© Cardio70 ", 150, 292);

        doc.save(`${inputData.age}_Cardio70_Report.pdf`);
    };



    function updateChartsTheme() {
        const theme = document.documentElement.getAttribute('data-theme');
        const textColor = theme === 'dark' ? '#b0bec5' : '#546e7a';
        const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        Object.values(Chart.instances).forEach(chart => {
            if (chart.options.scales.x) {
                chart.options.scales.x.ticks.color = textColor;
                chart.options.scales.x.grid.color = gridColor;
            }
            if (chart.options.scales.y) {
                chart.options.scales.y.ticks.color = textColor;
                chart.options.scales.y.grid.color = gridColor;
            }
            if (chart.options.plugins.legend) {
                chart.options.plugins.legend.labels.color = textColor;
            }
            chart.update();
        });
    }

    // Chart Initialization
    function initCharts() {
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: getComputedStyle(html).getPropertyValue('--color-text-muted').trim() }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: getComputedStyle(html).getPropertyValue('--color-text-muted').trim() }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: getComputedStyle(html).getPropertyValue('--color-text-muted').trim() }
                }
            }
        };

        // 1. Risk Distribution (Doughnut)
        const ctxRisk = document.getElementById('riskDistributionChart');
        if (ctxRisk) {
            new Chart(ctxRisk, {
                type: 'doughnut',
                data: {
                    labels: ['Low Risk', 'High Risk'],
                    datasets: [{
                        data: [51, 49],
                        backgroundColor: ['#4CAF50', '#FF5252'],
                        borderColor: 'transparent'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#b0bec5' } }
                    }
                }
            });
        }

        // 2. Recent Predictions (Line)
        const ctxRecent = document.getElementById('recentPredictionsChart');
        if (ctxRecent) {
            new Chart(ctxRecent, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Daily Predictions',
                        data: [12, 19, 15, 25, 22, 30, 28],
                        borderColor: '#00BCD4',
                        backgroundColor: 'rgba(0, 188, 212, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: commonOptions
            });
        }

        // 3. Feature Importance (Bar)
        const ctxFeat = document.getElementById('featureImportanceChart');
        if (ctxFeat) {
            new Chart(ctxFeat, {
                type: 'bar',
                data: {
                    labels: ['Systolic BP', 'Diastolic BP', 'Age', 'Cholesterol', 'BMI', 'Weight', 'Height', 'Glucose', 'Activity', 'Gender', 'Smoke', 'Alcohol'],
                    datasets: [{
                        label: 'Importance Score',
                        data: [0.38, 0.18, 0.15, 0.077, 0.070, 0.052, 0.04, 0.013, 0.009, 0.006, 0.005, 0.004],
                        backgroundColor: 'rgba(38, 198, 218, 0.7)',
                        borderColor: '#00BCD4',
                        fill: true
                    }]
                },
                options: {
                    ...commonOptions,
                    indexAxis: 'x' // Horizontal bar
                }
            });
        }

        // 4. ROC Curve (Line)
        const ctxRoc = document.getElementById('rocCurveChart');
        if (ctxRoc) {
            new Chart(ctxRoc, {
                type: 'line',
                data: {
                    labels: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
                    datasets: [{
                        label: 'ROC Curve (AUC = 0.94)',
                        data: [0, 0.5, 0.7, 0.82, 0.88, 0.92, 0.95, 0.97, 0.99, 1, 1],
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.2)',
                        fill: true,
                        tension: 0.3
                    }, {
                        label: 'Random Guess',
                        data: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
                        borderColor: '#78909c',
                        borderDash: [5, 5],
                        fill: false
                    }]
                },
                options: commonOptions
            });
        }

        // 5. Confusion Matrix (Bar approximation for viz)
        const ctxConf = document.getElementById('confusionMatrixChart');
        if (ctxConf) {
            new Chart(ctxConf, {
                type: 'bar',
                data: {
                    labels: ['True Positive', 'True Negative', 'False Positive', 'False Negative'],
                    datasets: [{
                        label: 'Count',
                        data: [850, 920, 80, 60],
                        backgroundColor: ['#4CAF50', '#2196F3', '#FF9800', '#FF5252']
                    }]
                },
                options: commonOptions
            });
        }

        // 6. HR vs Age (Scatter)
        const ctxScatter = document.getElementById('hrAgeScatterChart');
        if (ctxScatter) {
            new Chart(ctxScatter, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Healthy Controls',
                        data: Array.from({ length: 40 }, () => ({ x: 20 + Math.random() * 60, y: 60 + Math.random() * 20 })),
                        backgroundColor: '#4CAF50'
                    }, {
                        label: 'High Risk Patients',
                        data: Array.from({ length: 30 }, () => ({ x: 40 + Math.random() * 40, y: 80 + Math.random() * 40 })),
                        backgroundColor: '#FF5252'
                    }]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        x: { title: { display: true, text: 'Age (Years)', color: '#b0bec5' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                        y: { title: { display: true, text: 'Avg Heart Rate', color: '#b0bec5' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                    }
                }
            });
        }

        // 7. Cholesterol Dist
        const ctxChol = document.getElementById('cholesterolDistChart');
        if (ctxChol) {
            new Chart(ctxChol, {
                type: 'bar',
                data: {
                    labels: ['Normal (<200)', 'Above Normal (200-239)', 'High (240+)'],
                    datasets: [{
                        label: 'Patient Distribution %',
                        data: [45, 35, 20],
                        backgroundColor: ['#4CAF50', '#FF9800', '#FF5252']
                    }]
                },
                options: commonOptions
            });
        }

        // 8. Risk by Age
        const ctxRiskAge = document.getElementById('riskAgeChart');
        if (ctxRiskAge) {
            new Chart(ctxRiskAge, {
                type: 'line',
                data: {
                    labels: ['20-30', '30-40', '40-50', '50-60', '60-70', '70+'],
                    datasets: [{
                        label: 'High Risk Probability',
                        data: [5, 12, 25, 45, 65, 85],
                        borderColor: '#FF5252',
                        backgroundColor: 'rgba(255, 82, 82, 0.2)',
                        fill: true
                    }]
                },
                options: commonOptions
            });
        }
    }

    // Initialize
    initCharts();
});
