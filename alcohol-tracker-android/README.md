# Alcohol Tracker (Android)

Встроенный WebView-приложение (targetSdk 34), загружает статические файлы из `assets/www`.

## Сборка APK

1. Установите Android SDK/Android Studio (JDK 17).
2. Откройте папку `alcohol-tracker-android` в Android Studio.
3. Выберите Build > Build Bundle(s) / APK(s) > Build APK(s) — APK появится в `app/build/outputs/apk/`.

Через Gradle CLI:

```bash
cd alcohol-tracker-android
./gradlew :app:assembleRelease
```

APK: `app/build/outputs/apk/release/app-release.apk`

## Мобильная оптимизация

- В веб-части добавлен `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Мобильные стили в `styles.css` (`@media (max-width: 480px)`): уменьшенные отступы, более плотные ячейки календаря, модалка во всю ширину.
- WebView включает `setUseWideViewPort(true)` и `setLoadWithOverviewMode(true)` для корректного масштабирования.

## Где лежит веб-приложение

Содержимое `alcohol-tracker` скопировано в `app/src/main/assets/www`. При запуске `MainActivity` открывает `file:///android_asset/www/index.html`.