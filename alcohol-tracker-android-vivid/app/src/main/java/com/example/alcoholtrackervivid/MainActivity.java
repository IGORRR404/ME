package com.example.alcoholtrackervivid;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
	private WebView webView;

	@SuppressLint("SetJavaScriptEnabled")
	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);

		// Edge-to-edge content
		Window window = getWindow();
		window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
		window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);

		webView = new WebView(this);
		setContentView(webView);

		WebSettings settings = webView.getSettings();
		settings.setJavaScriptEnabled(true);
		settings.setDomStorageEnabled(true);
		settings.setSupportZoom(false);
		settings.setUseWideViewPort(true);
		settings.setLoadWithOverviewMode(true);
		settings.setMediaPlaybackRequiresUserGesture(false);

		webView.setWebViewClient(new WebViewClient());
		webView.setWebChromeClient(new WebChromeClient());

		webView.loadUrl("file:///android_asset/www/index.html");
	}

	@Override
	public void onBackPressed() {
		if (webView != null && webView.canGoBack()) {
			webView.goBack();
		} else {
			super.onBackPressed();
		}
	}
}