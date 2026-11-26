# Reglas R8 para kotlinx.serialization, Room y Glance.
-keepattributes *Annotation*, InnerClasses, EnclosingMethod, Signature
-keepclassmembers class * {
    @kotlinx.serialization.SerialName <fields>;
}
-keep,includedescriptorclasses class com.jowy05.jowyfit.**$$serializer { *; }
-keepclassmembers class com.jowy05.jowyfit.** {
    *** Companion;
}
-keepclasseswithmembers class com.jowy05.jowyfit.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep class com.jowy05.jowyfit.datos.catalogo.** { *; }
-keep class com.jowy05.jowyfit.widget.** { *; }

# MediaPipe Tasks Vision (JNI y callbacks nativos de BlazePose)
-keep class com.google.mediapipe.** { *; }
-dontwarn com.google.mediapipe.proto.**
-dontwarn javax.lang.model.**
-dontwarn com.google.auto.value.**
