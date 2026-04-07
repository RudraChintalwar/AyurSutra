from playwright.sync_api import sync_playwright
import time
import os

def take_screenshots():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create context with a larger viewport for better screenshots
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        print("Navigating to E-Mart...")
        page.goto("http://localhost:5173/emart", wait_until="networkidle")
        time.sleep(2)
        page.screenshot(path="ReportData/emart.png", full_page=True)

        print("Registering as a Patient...")
        page.goto("http://localhost:5173/login", wait_until="networkidle")
        
        # Click on Register Tab
        # Looking at shadcn/Radix tabs, usually it's [role="tab"] looking for "Register"
        time.sleep(1)
        page.click("button:has-text('Register'), [role='tab']:has-text('Register')")
        time.sleep(1)
        
        # Fill in Registration Form (assume standard email/password fields)
        # Random email
        patient_email = f"patient{int(time.time())}@example.com"
        
        # Try finding standard inputs
        email_inputs = page.locator("input[type='email']")
        # We might have login inputs and register inputs. Assuming the visible one is for register
        page.locator("input[name='name'], input[placeholder*='Name']").fill("Test Patient")
        email_inputs.locator("visible=true").fill(patient_email)
        page.locator("input[type='password']").locator("visible=true").fill("password123")
        page.locator("button[type='submit']:has-text('Register'), button[type='submit']:has-text('Create account')").click()
        
        # Wait for dashboard load
        print("Waiting for dashboard...")
        time.sleep(5)
        page.goto("http://localhost:5173/patient-dashboard", wait_until="networkidle")
        time.sleep(2)
        page.screenshot(path="ReportData/patient_dashboard.png", full_page=True)
        
        print("Navigating to Scheduling...")
        page.goto("http://localhost:5173/patient/sessions", wait_until="networkidle")
        time.sleep(3)
        page.screenshot(path="ReportData/scheduling_wizard.png", full_page=True)
        
        print("Logging out...")
        # Since Logout might be behind an avatar dropdown, let's just clear auth state by deleting indexedDB, or maybe just go to another context
        context.close()
        
        # New context for Doctor
        context2 = browser.new_context(viewport={"width": 1440, "height": 900})
        page2 = context2.new_page()
        
        print("Registering as a Doctor...")
        page2.goto("http://localhost:5173/login", wait_until="networkidle")
        time.sleep(1)
        page2.click("button:has-text('Register'), [role='tab']:has-text('Register')")
        time.sleep(1)
        
        # Select Doctor role if there is a radio/switch/select
        # The readme says "use the verification code AyurSutraDoc7898"
        try:
            page2.locator("label:has-text('Doctor'), button:has-text('Doctor'), [role='radio']:has-text('Doctor')").click()
            time.sleep(1)
            page2.fill("input[placeholder*='code'], input[name='verificationCode']", "AyurSutraDoc7898")
        except:
            pass

        doctor_email = f"doctor{int(time.time())}@example.com"
        page2.locator("input[name='name'], input[placeholder*='Name']").fill("Dr. Ayurveda")
        page2.locator("input[type='email']").locator("visible=true").fill(doctor_email)
        page2.locator("input[type='password']").locator("visible=true").fill("password123")
        page2.locator("button[type='submit']:has-text('Register'), button[type='submit']:has-text('Create account')").click()
        
        print("Waiting for doctor dashboard...")
        time.sleep(5)
        page2.goto("http://localhost:5173/doctor-dashboard", wait_until="networkidle")
        time.sleep(2)
        page2.screenshot(path="ReportData/doctor_dashboard.png", full_page=True)
        
        context2.close()
        browser.close()
        print("Done!")

if __name__ == '__main__':
    take_screenshots()
